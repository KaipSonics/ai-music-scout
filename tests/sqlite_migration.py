import sqlite3,tempfile,pathlib
sql=pathlib.Path('src-tauri/migrations/003_opportunities.sql').read_text()
with tempfile.TemporaryDirectory() as folder:
 db=sqlite3.connect(pathlib.Path(folder)/'scout.db')
 db.executescript("CREATE TABLE artists(id TEXT PRIMARY KEY,status TEXT,notes TEXT);CREATE TABLE history(artist_id TEXT,content TEXT);CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);INSERT INTO artists VALUES('old','Ответил','сохранить');INSERT INTO history VALUES('old','диалог');INSERT INTO settings VALUES('offer','original');")
 db.execute('VACUUM INTO ?', (str(pathlib.Path(folder)/'before.db'),))
 db.executescript(sql);db.executescript(sql)
 assert db.execute('SELECT status,notes FROM artists').fetchone()==('Ответил','сохранить')
 assert db.execute('SELECT content FROM history').fetchone()==('диалог',)
 assert db.execute('SELECT value FROM settings').fetchone()==('original',)
 db.execute("INSERT INTO scout_records(id,body) VALUES('group:1','{}')");db.commit()
 try:
  with db:
   db.execute('DELETE FROM scout_records');db.execute("INSERT INTO scout_records(id,body) VALUES('group:2','{}')");raise ValueError('failed batch')
 except ValueError:pass
 assert db.execute('SELECT id FROM scout_records').fetchone()==('group:1',)
 backup=sqlite3.connect(pathlib.Path(folder)/'before.db');assert backup.execute('SELECT notes FROM artists').fetchone()==('сохранить',)
 print('SQLite: additive migration, idempotence, legacy preservation, backup and rollback passed')
