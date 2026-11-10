use rusqlite::params;
use serde_json::Value;
use tauri::State;
use crate::models::AppState;

#[tauri::command]
pub fn scout_get_records(state:State<AppState>)->Result<Vec<Value>,String>{
    let db=state.db.lock().map_err(|e|e.to_string())?;
    let mut stmt=db.prepare("SELECT body FROM scout_records ORDER BY updated_at DESC").map_err(|e|e.to_string())?;
    let rows=stmt.query_map([],|row|row.get::<_,String>(0)).map_err(|e|e.to_string())?;
    let mut output=Vec::new();
    for row in rows {
      let data=row.map_err(|e|e.to_string())?;
      output.push(serde_json::from_str::<Value>(&data).map_err(|e|format!("CRM record JSON corrupted: {}",e))?);
    }
    Ok(output)
}
#[tauri::command]
pub fn scout_save_records(state:State<AppState>,records:Vec<Value>)->Result<(),String>{
    if records.len()>2500{return Err("Лимит CRM — 2500 записей".into())}
    let mut conn=state.db.lock().map_err(|e|e.to_string())?;
    let tx=conn.transaction().map_err(|e|e.to_string())?;
    // Only the v3 table is replaced. Never delete legacy Scout v2 artists.
    tx.execute("DELETE FROM scout_records",[]).map_err(|e|e.to_string())?;
    for record in records {
        let id=record.get("id").and_then(Value::as_str).ok_or("Отсутствует ID контакта")?;
        if id.is_empty() || id.len()>128 || record.get("opportunity").is_none() {
            return Err("Некорректная запись CRM".into());
        }
        let body=serde_json::to_string(&record).map_err(|e|e.to_string())?;
        if body.len()>150000{return Err("Слишком большая запись CRM".into())}
        tx.execute("INSERT INTO scout_records(id,body) VALUES(?1,?2)",params![id,body]).map_err(|e|e.to_string())?;
    }
    tx.commit().map_err(|e|e.to_string())
}
