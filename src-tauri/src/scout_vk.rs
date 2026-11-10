use serde_json::Value;
use reqwest::Client;
use std::time::Duration;
const API:&str="5.131";

fn clean_token(token:&str)->String{
    let t=token.trim();
    if let Some((_,after))=t.split_once("access_token=") {
        after.split('&').next().unwrap_or("").trim().to_owned()
    } else { t.to_owned() }
}
pub(crate) async fn api_call(method:&str,params:Vec<(&str,String)>,token:String)->Result<Value,String>{
    let key=clean_token(&token);
    if key.is_empty(){return Err("VK-токен отсутствует".into())}
    let client=Client::builder().timeout(Duration::from_secs(18))
      .user_agent("ASV-Scout/3.0")
      .build().map_err(|e|format!("VK client: {}",e))?;
    let mut q:Vec<(&str,String)>=params;
    q.push(("access_token",key));
    q.push(("v",API.to_owned()));
    let resp=client.post(format!("https://api.vk.com/method/{}",method)).form(&q).send().await
      .map_err(|_|format!("VK {}: сеть недоступна или таймаут",method))?;
    let status=resp.status();
    if !status.is_success(){return Err(format!("VK {}: HTTP {}",method,status));}
    let body:Value=resp.json().await.map_err(|e|format!("VK {}: некорректный JSON: {}",method,e))?;
    if let Some(error)=body.get("error"){
        let code=error.get("error_code").and_then(Value::as_i64).unwrap_or(0);
        let message=match code {5=>"Недействительный токен",6|29=>"Лимит запросов. Повторите позже",15|27=>"Нет прав доступа",_=>"Запрос отклонён VK"};
        return Err(format!("VK {} ({}): {}",method,code,message));
    }
    body.get("response").cloned().ok_or_else(||format!("VK {}: отсутствует response",method))
}
#[tauri::command]
pub async fn scout_test_token(token:String)->Result<String,String>{
    let v=api_call("users.get",vec![],token).await?;
    let user=v.as_array().and_then(|xs|xs.first()).ok_or("VK users.get: пустой ответ")?;
    if user.get("first_name").and_then(Value::as_str).is_none() || user.get("last_name").and_then(Value::as_str).is_none(){return Err("VK: некорректный профиль пользователя".into())}
    Ok(format!("{} {}",user.get("first_name").and_then(Value::as_str).unwrap_or(""),user.get("last_name").and_then(Value::as_str).unwrap_or("")))
}
#[tauri::command]
pub async fn vk_search_v3(query:String,count:u32,offset:u32,token:String)->Result<Value,String>{
    api_call("groups.search",vec![("q",query),("count",count.min(100).to_string()),("offset",offset.to_string())],token).await
}
#[tauri::command]
pub async fn vk_get_wall_v3(owner_id:i64,count:u32,token:String)->Result<Value,String>{
    api_call("wall.get",vec![("owner_id",owner_id.to_string()),("count",count.min(50).to_string()),("filter","owner".to_owned())],token).await
}
#[tauri::command]
pub async fn vk_newsfeed_search_v3(query:String,start_time:i64,extended:u8,count:u32,token:String)->Result<Value,String>{
    api_call("newsfeed.search",vec![("q",query),("start_time",start_time.to_string()),
      ("extended",extended.min(1).to_string()),("count",count.min(100).to_string())],token).await
}
#[tauri::command]
pub fn open_url(url:String)->Result<(),String>{
    if !(url.starts_with("https://vk.com/")||url.starts_with("https://m.vk.com/")||url.starts_with("https://vk.ru/")||url.starts_with("https://vk.me/")||url.starts_with("https://dev.vk.com/")) || url.chars().any(|c|c.is_control()||c==' '){
        return Err("Разрешены только HTTPS-ссылки VK".into());
    }
    #[cfg(target_os="macos")]
    let result=std::process::Command::new("open").arg(&url).spawn();
    #[cfg(target_os="linux")]
    let result=std::process::Command::new("xdg-open").arg(&url).spawn();
    #[cfg(target_os="windows")]
    let result=std::process::Command::new("rundll32.exe").arg("url.dll,FileProtocolHandler").arg(&url).spawn();
    result.map(|_|()).map_err(|e|e.to_string())
}

#[tauri::command]
pub async fn scout_get_owner(owner_id:i64,token:String)->Result<Value,String>{
 if owner_id<0 { api_call("groups.getById",vec![("group_ids",(-owner_id).to_string()),("fields","description,members_count,activity,status,photo_200".into())],token).await }
 else {api_call("users.get",vec![("user_ids",owner_id.to_string()),("fields","about,status,domain,photo_200".into())],token).await}
}
