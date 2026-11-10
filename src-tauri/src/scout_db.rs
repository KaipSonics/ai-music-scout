use rusqlite::{params,Connection,TransactionBehavior};
use serde_json::{Value,json};
use tauri::State;
use crate::models::AppState;

fn snapshot(db:&Connection)->Result<(Vec<Value>,i64),String>{
 // A read transaction keeps records and revision from the same SQLite snapshot.
 let tx=db.unchecked_transaction().map_err(|e|e.to_string())?;
 let output={let mut stmt=tx.prepare("SELECT body FROM scout_records ORDER BY updated_at DESC,id").map_err(|e|e.to_string())?;
 let rows=stmt.query_map([],|r|r.get::<_,String>(0)).map_err(|e|e.to_string())?;
 let mut output=Vec::new();for row in rows{let body=row.map_err(|e|e.to_string())?;output.push(serde_json::from_str(&body).map_err(|_|"CRM: повреждённая запись".to_string())?);}output};
 let revision=tx.query_row("SELECT CAST(value AS INTEGER) FROM settings WHERE key='scout_revision'",[],|r|r.get::<_,i64>(0)).unwrap_or(0);
 tx.commit().map_err(|e|e.to_string())?;Ok((output,revision))
}
fn save(db:&mut Connection,records:Vec<Value>,expected_revision:i64)->Result<(),String>{
 if records.len()>2500{return Err("Лимит CRM — 2500 записей".into())}
 let tx=db.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|e|e.to_string())?;
 let current=tx.query_row("SELECT CAST(value AS INTEGER) FROM settings WHERE key='scout_revision'",[],|r|r.get::<_,i64>(0)).unwrap_or(0);
 if current!=expected_revision{return Err("CRM изменена в другом экземпляре. Повторите действие после обновления.".into())}
 tx.execute("DELETE FROM scout_records",[]).map_err(|e|e.to_string())?;
 for record in records{
  let id=record.get("id").and_then(Value::as_str).ok_or("Отсутствует ID")?;
  if id.is_empty()||id.len()>128||record.get("opportunity").is_none(){return Err("Некорректная запись CRM".into())}
  let body=serde_json::to_string(&record).map_err(|e|e.to_string())?;if body.len()>1000000{return Err("Запись CRM превышает 1 МБ; экспортируйте историю".into())}
  tx.execute("INSERT INTO scout_records(id,body) VALUES(?1,?2)",params![id,body]).map_err(|e|e.to_string())?;
 }
 tx.execute("INSERT INTO settings(key,value) VALUES('scout_revision',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[(current+1).to_string()]).map_err(|e|e.to_string())?;
 tx.commit().map_err(|e|e.to_string())
}
#[tauri::command]
pub fn scout_get_snapshot(state:State<AppState>)->Result<Value,String>{let db=state.db.lock().map_err(|e|e.to_string())?;let (records,revision)=snapshot(&db)?;Ok(json!({"records":records,"revision":revision}))}
#[tauri::command]
pub fn scout_get_records(state:State<AppState>)->Result<Vec<Value>,String>{let db=state.db.lock().map_err(|e|e.to_string())?;Ok(snapshot(&db)?.0)}
#[tauri::command]
pub fn scout_save_records(state:State<AppState>,records:Vec<Value>,expected_revision:i64)->Result<(),String>{let mut db=state.db.lock().map_err(|e|e.to_string())?;save(&mut db,records,expected_revision)}
#[cfg(test)]
mod tests{
 use super::*;
 fn database()->Connection{let db=Connection::open_in_memory().unwrap();db.execute_batch("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);").unwrap();db.execute_batch(include_str!("../migrations/003_opportunities.sql")).unwrap();db}
 #[test]fn stale_writer_cannot_overwrite_crm(){let mut db=database();save(&mut db,vec![json!({"id":"group:42","opportunity":{},"note":"keep"})],0).unwrap();assert!(save(&mut db,vec![],0).is_err());let (rows,revision)=snapshot(&db).unwrap();assert_eq!(rows[0]["note"],"keep");assert_eq!(revision,1);}
 #[test]fn malformed_batch_rolls_back_records_and_revision(){let mut db=database();save(&mut db,vec![json!({"id":"user:1","opportunity":{}})],0).unwrap();assert!(save(&mut db,vec![json!({"invalid":true})],1).is_err());let(rows,revision)=snapshot(&db).unwrap();assert_eq!(rows[0]["id"],"user:1");assert_eq!(revision,1);}
}
