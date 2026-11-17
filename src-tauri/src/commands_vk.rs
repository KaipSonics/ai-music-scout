use serde_json::Value;
use crate::scout_vk::api_call;
#[tauri::command]
pub async fn vk_test_token(token:String)->Result<String,String>{crate::scout_vk::scout_test_token(token).await}
#[tauri::command]
pub async fn vk_search(query:String,token:String)->Result<Value,String>{crate::scout_vk::vk_search_v3(query,50,0,token).await}
#[tauri::command]
pub async fn vk_get_wall(id:String,token:String)->Result<Value,String>{
 let number=id.parse::<i64>().map_err(|_|"Некорректный ID сообщества")?;
 crate::scout_vk::vk_get_wall_v3(-number.abs(),20,token).await
}
#[tauri::command]
pub async fn vk_get_group(id:String,token:String)->Result<Value,String>{
 let value=api_call("groups.getById",vec![("group_ids",id),("fields","description,members_count,contacts,links,photo_200".into())],token).await?;
 value.as_array().or_else(||value.get("groups").and_then(Value::as_array)).and_then(|rows|rows.first()).cloned().ok_or_else(||"VK: сообщество не найдено".into())
}
#[tauri::command]
pub async fn vk_get_user(id:String,token:String)->Result<Value,String>{
 let value=api_call("users.get",vec![("user_ids",id),("fields","photo_200,domain,status,about".into())],token).await?;
 value.as_array().and_then(|rows|rows.first()).cloned().ok_or_else(||"VK: профиль не найден".into())
}
#[tauri::command]
pub async fn vk_get_members(id:String,token:String)->Result<Value,String>{api_call("groups.getMembers",vec![("group_id",id),("count","0".into())],token).await}
#[tauri::command]
pub async fn vk_newsfeed_search(query:String,token:String)->Result<Value,String>{
 crate::scout_vk::vk_newsfeed_search_v3(query,0,1,40,token).await
}
