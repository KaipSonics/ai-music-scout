/** Only user-entered session credentials; never persisted or bundled. */
let backendUrl='';let accessKey='';
export function configureBackend(url:string,key:string){
 if(url){let parsed:URL;try{parsed=new URL(url);}catch{throw new Error('Некорректный адрес API-сервера');}
 if((parsed.protocol!=='https:' && !(parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname)))||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error('API-сервер: требуется HTTPS (HTTP разрешён только для localhost)');
 backendUrl=parsed.href.replace(/\/$/,'');
 }else backendUrl='';accessKey=key.trim();
}
export function backendConfiguration(){return {url:backendUrl,key:accessKey};}
export function aborted(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Поиск отменён пользователем','AbortError');}
export function abortable<T>(promise:Promise<T>,signal?:AbortSignal):Promise<T>{
 aborted(signal);if(!signal)return promise;
 return new Promise((resolve,reject)=>{const cancel=()=>reject(new DOMException('Поиск отменён пользователем','AbortError'));signal.addEventListener('abort',cancel,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));});
}
