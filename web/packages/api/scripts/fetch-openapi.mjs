// Fetches the OpenAPI document from a running app and saves it as openapi.json, which is committed: the console builds
// from the saved copy, and regenerating it shows any change to the API as a diff.
// Usage: FABOR_API=http://localhost:18080 FABOR_API_TOKEN=... node scripts/fetch-openapi.mjs
import { writeFileSync } from "node:fs";

const base = process.env.FABOR_API ?? "http://localhost:18080";
const token = process.env.FABOR_API_TOKEN ?? "ui-smoke-token-123456";
const res = await fetch(`${base}/api/v1/openapi`, { headers: { Authorization: `Bearer ${token}`, "X-Actor": "openapi-generator" } });
if (!res.ok) {
  console.error(`GET ${base}/api/v1/openapi -> ${res.status}`);
  process.exit(1);
}
const doc = await res.json();
writeFileSync(new URL("../openapi.json", import.meta.url), JSON.stringify(doc, null, 2) + "\n");
console.log(`openapi.json: ${Object.keys(doc.paths ?? {}).length} paths`);
