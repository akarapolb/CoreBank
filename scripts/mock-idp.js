// A tiny OpenID Connect provider for local development and browser tests: discovery, JWKS, authorization code with
// PKCE (S256 enforced) and RS256 access tokens. NOT for production: it signs in anyone as the user in ?login_hint.
// Usage: node scripts/mock-idp.js [port]   (default 18090, issuer http://localhost:<port>)
const http = require('http');
const crypto = require('crypto');
const port = Number(process.argv[2] || 18090);
const issuer = `http://localhost:${port}`;
const allowedOrigin = process.env.CONSOLE_ORIGIN || 'http://localhost:18080';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'mock-1', alg: 'RS256', use: 'sig' };
const roles = {
  maya: ['product-maker', 'ops'], bob: ['approver-product'], rita: ['approver-risk'], fin: ['approver-finance'],
  carl: ['approver-compliance'], lead: ['product-publisher', 'ops-admin', 'ops'], nobody: [],
};
const codes = new Map();
const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (claims) => {
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'mock-1' }));
  const body = b64(JSON.stringify(claims));
  return `${head}.${body}.${crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`;
};
const json = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin });
  res.end(JSON.stringify(obj));
};

http.createServer((req, res) => {
  const url = new URL(req.url, issuer);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST' });
    return res.end();
  }
  if (url.pathname === '/.well-known/openid-configuration') {
    return json(res, 200, { issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'] });
  }
  if (url.pathname === '/jwks') return json(res, 200, { keys: [jwk] });
  if (url.pathname === '/authorize') {
    const q = url.searchParams;
    if (q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge') || !q.get('client_id')) {
      res.writeHead(400); return res.end('PKCE with S256 is required');
    }
    const code = crypto.randomBytes(16).toString('hex');
    codes.set(code, { challenge: q.get('code_challenge'), redirect: q.get('redirect_uri'), client: q.get('client_id'),
      user: q.get('login_hint') || process.env.MOCK_USER || 'maya' });
    const back = new URL(q.get('redirect_uri'));
    back.searchParams.set('code', code);
    back.searchParams.set('state', q.get('state'));
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      const f = new URLSearchParams(data);
      const entry = codes.get(f.get('code'));
      codes.delete(f.get('code'));                       // a code works once
      const ok = entry && entry.redirect === f.get('redirect_uri') && entry.client === f.get('client_id')
        && b64(crypto.createHash('sha256').update(f.get('code_verifier') || '').digest()) === entry.challenge;
      if (!ok) return json(res, 400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
      const now = Math.floor(Date.now() / 1000);
      return json(res, 200, { token_type: 'Bearer', expires_in: 300, access_token: sign({
        iss: issuer, sub: `sub-${entry.user}`, preferred_username: entry.user, iat: now, exp: now + 300,
        realm_access: { roles: roles[entry.user] || [] } }) });
    });
    return undefined;
  }
  res.writeHead(404); return res.end();
}).listen(port, () => console.log(`mock IdP on ${issuer}`));
