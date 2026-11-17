import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const METHODS={
 'users.get':new Set(['user_ids','fields']),
 'groups.getById':new Set(['group_ids','fields']),
 'groups.search':new Set(['q','count','offset']),
 'newsfeed.search':new Set(['q','count','start_time','extended']),
 'wall.get':new Set(['owner_id','count','filter'])
};
export function createScoutServer({accessKey,allowedOrigins=[],dist='dist',vkFetch=fetch,now=Date.now}={}){
 if(typeof accessKey!=='string'||accessKey.length<24)throw new Error('SCOUT_ACCESS_KEY must contain at least 24 characters');
 const expected=createHash('sha256').update(accessKey).digest(),limits=new Map();
 function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
 return http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),origin=req.headers.origin;
  if(url.pathname==='/health'){send(res,200,{ok:true});return;}
  if(!url.pathname.startsWith('/api/vk/')){
   if(!['GET','HEAD'].includes(req.method)){send(res,405,{message:'Method not allowed'});return;}
   const base=resolve(dist);let path;
   try{path=resolve(base,'.'+decodeURIComponent(url.pathname.replace(/^\/ai-music-scout/,'')||'/'));}catch{send(res,400,{message:'Invalid path'});return;}
   if(path!==base&&!path.startsWith(base+sep)){send(res,403,{message:'Forbidden'});return;}
   try{const filename=extname(path)?path:resolve(base,'index.html');const bytes=await readFile(filename);
    res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf','.png':'image/png'})[extname(filename)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
   }catch{send(res,404,{message:'Not found'});}return;
  }
  if(origin&&!allowedOrigins.includes(origin)){send(res,403,{message:'Origin not allowed'});return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Max-Age':'600'});res.end();return;}
  if(req.method!=='POST'){send(res,405,{message:'POST required'});return;}
  const provided=createHash('sha256').update(String(req.headers.authorization||'').replace(/^Bearer /,'')).digest();
  if(!timingSafeEqual(expected,provided)){send(res,401,{message:'API server authorization required'});return;}
  const method=url.pathname.slice('/api/vk/'.length),allow=METHODS[method];
  if(!allow){send(res,400,{message:'VK method not allowed'});return;}
  let size=0,body='';
  try{for await(const chunk of req){size+=chunk.length;if(size>16384){send(res,413,{message:'Request too large'});return;}body+=chunk;}}
  catch{send(res,400,{message:'Invalid request body'});return;}
  const input=new URLSearchParams(body),token=input.get('access_token');
  if(!token||token.length>4096){send(res,400,{message:'VK token required'});return;}
  const params=new URLSearchParams({access_token:token,v:'5.131'});
  for(const [key,value]of input){if(key==='access_token'||key==='v')continue;if(!allow.has(key)||value.length>2000){send(res,400,{message:'Invalid VK parameters'});return;}params.set(key,value);}
  if(params.has('count')&&(!/^\d+$/.test(params.get('count'))||+params.get('count')>100)){send(res,400,{message:'Invalid count'});return;}
  const fingerprint=createHash('sha256').update(token).digest('hex'),time=now(),prior=limits.get(fingerprint)||0;
  for(const [key,at]of limits)if(time-at>60000)limits.delete(key);
  if(time-prior<370||limits.size>=1000){res.setHeader('Retry-After','1');send(res,429,{message:'Wait before next VK request'});return;}limits.set(fingerprint,time);
  try{
   const response=await vkFetch('https://api.vk.com/method/'+method,{method:'POST',body:params,signal:AbortSignal.timeout(18000),redirect:'error'});
   if(!response.ok){send(res,502,{message:'VK upstream HTTP error'});return;}
   const data=await response.json();
   if(data?.error){send(res,200,{error:{error_code:Number(data.error.error_code)||0,error_msg:'VK rejected request'}});return;}
   if(data?.response===undefined){send(res,502,{message:'Invalid VK response'});return;}
   send(res,200,{response:data.response});
  }catch{send(res,502,{message:'VK unavailable, timed out or returned invalid JSON'});}
 });
}
