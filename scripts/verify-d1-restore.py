#!/usr/bin/env python3
"""Validate a D1 SQL export by restoring it to a throwaway local SQLite file.

This is intentionally OFFLINE. It never connects to Cloudflare or imports into
production. Input and test database are destroyed by the caller / tempfile.
"""
import pathlib
import sqlite3
import sys
import tempfile

def check(path):
    sql = pathlib.Path(path).read_text(encoding="utf-8")
    if not sql.strip():
        raise SystemExit("D1 export is empty")
    with tempfile.TemporaryDirectory(prefix="grizzly-restore-") as temp:
        destination = pathlib.Path(temp) / "restore.sqlite"
        db = sqlite3.connect(destination)
        try:
            db.executescript(sql)
            result = db.execute("PRAGMA quick_check").fetchone()[0]
            if result != "ok":
                raise RuntimeError("SQLite quick_check: " + str(result))
            names = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            for required in ("users", "records"):
                if required not in names:
                    raise RuntimeError("Missing essential table in restored dump: " + required)
            print("Offline D1 SQL restore OK: SQLite quick_check=ok; essential tables present")
        finally:
            db.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: verify-d1-restore.py <decrypted-export.sql>")
    check(sys.argv[1])
