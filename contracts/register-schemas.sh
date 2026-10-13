#!/usr/bin/env bash
# Registers every Avro schema with Apicurio Registry and enforces BACKWARD compatibility.
# Usage: contracts/register-schemas.sh [registry-url]   (default http://localhost:8081)
set -euo pipefail
REG="${1:-http://localhost:8081}/apis/registry/v2"
cd "$(dirname "$0")/.."
for f in $(find . -path '*/src/main/resources/avro/*.avsc' -not -path '*/target/*'); do
  name=$(basename "$f" .avsc)
  echo "registering $name from $f"
  curl -fsS -X POST "$REG/groups/fabor.ledger/artifacts" \
    -H "Content-Type: application/json" -H "X-Registry-ArtifactId: $name" \
    -H "X-Registry-ArtifactType: AVRO" -H "X-Registry-Name: $name" \
    --data-binary "@$f" >/dev/null || \
  curl -fsS -X PUT "$REG/groups/fabor.ledger/artifacts/$name" \
    -H "Content-Type: application/json" --data-binary "@$f" >/dev/null
  curl -fsS -X POST "$REG/groups/fabor.ledger/artifacts/$name/rules" \
    -H "Content-Type: application/json" -d '{"type":"COMPATIBILITY","config":"BACKWARD"}' >/dev/null || true
done
