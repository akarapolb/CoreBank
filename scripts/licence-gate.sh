#!/usr/bin/env bash
# Fails the build if any dependency carries a licence outside the open-source allowlist (ADR-0006).
# The one recorded exception is the Oracle JDBC driver: scope "provided", never bundled, supplied by the customer.
set -euo pipefail
cd "$(dirname "$0")/.."
mvn -q -B org.codehaus.mojo:license-maven-plugin:2.4.0:aggregate-add-third-party
report=target/generated-sources/license/THIRD-PARTY.txt
allow='Apache|MIT|BSD|Eclipse Public License|EPL|ISC|CC0|Public Domain|MPL|Mozilla|Common Development'
exceptions='Oracle Free Use Terms'
bad=$(grep -E '^\s*\(' "$report" | grep -viE "$allow" | grep -vF "$exceptions" || true)
if [ -n "$bad" ]; then
  echo "Disallowed licences found:"; echo "$bad"; exit 1
fi
echo "Licence gate passed ($(grep -cE '^\s*\(' "$report") dependencies checked)"
