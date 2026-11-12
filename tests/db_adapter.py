"""Persistent SQLite bridge for tests, emulates the D1 prepare/batch interface."""
import json,sys,sqlite3
con=None
for line in sys.stdin:
    try:
        payload=json.loads(line)
        if con is None:
            con=sqlite3.connect(payload['file'])
            con.row_factory=sqlite3.Row
            con.execute('PRAGMA foreign_keys=ON')
        if 'init' in payload:
            con.executescript(payload['init'])
            con.commit()
            result={'ok': True}
        else:
            out=[]
            if payload.get('transaction'):con.execute('BEGIN')
            for s in payload['statements']:
                cursor=con.execute(s['sql'],s.get('params',[]))
                rows=[dict(x) for x in cursor.fetchall()] if cursor.description else []
                changes=cursor.rowcount if cursor.rowcount >=0 else 0
                out.append({'results':rows,'meta':{'changes':changes}})
            con.commit()
            result={'items':out}
    except Exception as e:
        if con:con.rollback()
        result={'error':str(e)}
    print(json.dumps(result),flush=True)
