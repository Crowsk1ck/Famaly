#!/usr/bin/env bash
set -euo pipefail
# CI uses generated synthetic content only; no production secrets or backups.
umask 077
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
python3 - "$dir/fixture.sql" <<'PY'
import sqlite3, sys
db=sqlite3.connect(":memory:")
db.executescript("""CREATE TABLE users(id TEXT PRIMARY KEY,nickname TEXT);
CREATE TABLE records(id TEXT PRIMARY KEY,title TEXT);
INSERT INTO users VALUES('test-id','Synthetic user only');
INSERT INTO records VALUES('task-id','Synthetic task only');""")
with open(sys.argv[1],"w",encoding="utf-8") as file:
    file.write("\n".join(db.iterdump())+"\n")
db.close()
PY
passphrase='ci-only-ephemeral-test-key-not-a-production-secret'
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 310000 \
  -in "$dir/fixture.sql" -out "$dir/fixture.sql.enc" -pass "pass:$passphrase"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 310000 \
  -in "$dir/fixture.sql.enc" -out "$dir/restored.sql" -pass "pass:$passphrase"
cmp -s "$dir/fixture.sql" "$dir/restored.sql"
python3 scripts/verify-d1-restore.py "$dir/restored.sql"
echo 'Synthetic encrypted D1 backup/decrypt/restore drill passed'
