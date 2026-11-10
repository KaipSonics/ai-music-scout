import { invoke as tauriInvoke } from '@tauri-apps/api/core';
export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function openExternal(url:string):Promise<void> {
  let parsed: URL;
  try { parsed=new URL(url); } catch {throw new Error('Некорректная ссылка');}
  if(parsed.protocol!=='https:' || !['vk.com','m.vk.com','vk.ru','vk.me','dev.vk.com'].includes(parsed.hostname) || parsed.username || parsed.password) throw new Error('Разрешены HTTPS-ссылки VK');
  if(isTauri()) await tauriInvoke('open_url',{url:parsed.href});
  else window.open(parsed.href,'_blank','noopener,noreferrer');
}
function read<T>(key:string,fallback:T):T {
  const data=localStorage.getItem(key);
  try {return data===null?fallback:JSON.parse(data) as T;} catch {throw new Error('Данные CRM повреждены. Восстановите резервную копию.');}
}
// Existing v2 browser CRM stays readable and editable; unsupported calls always fail explicitly.
export async function safeInvoke<T=any>(command:string,args:Record<string,any>={}):Promise<T> {
  if(command.startsWith('ai_')) throw new Error('AI-оценки заменены общим движком Scout 3.0. Используйте радар и публикации-источники.');
  if(command==='open_url') {await openExternal(String(args.url));return undefined as T;}
  if(command==='db_save_history'){const history=args.history||{artist_id:args.artistId,record_type:args.recordType,content:args.content};args={...args,history,artistId:history.artist_id,recordType:history.record_type,content:history.content};}
  if(isTauri()) return tauriInvoke<T>(command,args);
  const key='asv_crm_artists';
  const list=()=>read<any[]>(key,[]);
  let result:unknown;
  switch(command){
    case 'db_get_artists': result=list().filter(a=>!args.statusFilter || a.status===args.statusFilter); break;
    case 'db_get_artist': result=list().find(a=>a.id===args.id)||null; break;
    case 'db_save_artist': {
      const rows=list(), item={...args.artist};
      const old=rows.find(a=>a.id===item.id || (item.vk_id && a.vk_id===item.vk_id));
      item.id=old?.id||item.id||crypto.randomUUID();
      const idx=rows.findIndex(a=>a.id===item.id);
      if(idx<0) rows.push(item); else rows[idx]={...rows[idx],...item};
      localStorage.setItem(key,JSON.stringify(rows));result=item.id;break;
    }
    case 'db_update_status': case 'db_update_notes': {
      const rows=list(), idx=rows.findIndex(a=>a.id===args.id);
      if(idx<0)throw new Error('Артист не найден');
      if(command==='db_update_status')rows[idx].status=args.status;else rows[idx].notes=args.notes;
      localStorage.setItem(key,JSON.stringify(rows));break;
    }
    case 'db_delete_artist': localStorage.setItem(key,JSON.stringify(list().filter(a=>a.id!==args.id)));break;
    case 'db_get_history': result=read<any[]>('asv_crm_history',[]).filter(a=>a.artist_id===args.artistId);break;
    case 'db_save_history': {
      const rows=read<any[]>('asv_crm_history',[]);
      rows.push({id:crypto.randomUUID(),artist_id:args.artistId,record_type:args.recordType,content:args.content,created_at:new Date().toISOString()});
      localStorage.setItem('asv_crm_history',JSON.stringify(rows));break;
    }
    case 'db_get_stats': result={total:list().length,new:list().filter(a=>a.status==='Новый').length,favorites:list().filter(a=>a.status==='Избранное').length};break;
    case 'db_delete_setting': localStorage.removeItem('asv_setting_'+args.key);break;
    case 'db_get_setting': result=/token|api_key/i.test(args.key)?'':localStorage.getItem('asv_setting_'+args.key)||'';break;
    case 'db_set_setting':
      if(/token|api_key/i.test(args.key))throw new Error('Ключи разрешено хранить только в памяти сессии');
      localStorage.setItem('asv_setting_'+args.key,String(args.value||''));break;
    default: throw new Error('Команда недоступна в браузере: '+command);
  }
  return result as T;
}
