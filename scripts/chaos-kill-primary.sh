#!/usr/bin/env bash
# Phase 0 exit check: kill -9 the PostgreSQL primary under load, restart it, and prove that no
# acknowledged posting was lost and the ledger is consistent. Run as a user that may signal postgres.
#   scripts/chaos-kill-primary.sh <jdbc-url> <user> <pg-restart-command...>
# Example (local):
#   scripts/chaos-kill-primary.sh jdbc:postgresql://localhost:5433/fabor pg \
#       su pg -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o '-p 5433 -k /tmp' -l /tmp/pg.log start"
set -euo pipefail
URL=$1; USER=$2; shift 2
CP=${CHAOS_CLASSPATH:?set CHAOS_CLASSPATH to the ledger-perf runtime classpath}
MODE=${CHAOS_MODE:-group}
ACKS=$(mktemp)
java -cp "$CP" org.fabor.ledger.perf.ChaosCheck write "$URL" "$USER" "" 24 20 "$ACKS" "$MODE" &
WRITER=$!
sleep 6
for round in 1 2; do
  echo "[chaos] kill -9 postmaster (round $round)"
  pkill -9 -x postgres || true
  sleep 2
  echo "[chaos] restarting"
  "$@" >/dev/null
  sleep 3
done
wait $WRITER
java -cp "$CP" org.fabor.ledger.perf.ChaosCheck verify "$URL" "$USER" "" "$ACKS"
