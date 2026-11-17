import {test} from 'node:test';import assert from 'node:assert/strict';import {createScoutServer} from '../server/app.mjs';
const key='test-only-api-server-key-long-enough';
async function withServer(options,run){const server=createScoutServer({accessKey:key,allowedOrigins:['https://scout.example'],...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
test('backend requires configuration, authentication, exact origin and allowlisted method',async()=>{
 assert.throws(()=>createScoutServer({accessKey:'short'}));
 await withServer({vkFetch:async()=>{throw Error('must not call upstream');}},async base=>{
  assert.equal((await fetch(base+'/api/vk/wall.get',{method:'POST'})).status,401);
  assert.equal((await fetch(base+'/api/vk/wall.get',{method:'POST',headers:{Origin:'https://evil.example',Authorization:'Bearer '+key}})).status,403);
  assert.equal((await fetch(base+'/api/vk/messages.send',{method:'POST',headers:{Authorization:'Bearer '+key}})).status,400);
  const preflight=await fetch(base+'/api/vk/wall.get',{method:'OPTIONS',headers:{Origin:'https://scout.example'}});assert.equal(preflight.headers.get('access-control-allow-origin'),'https://scout.example');
 });
});
test('backend forwards only official VK POST, strips raw errors and enforces rate/size limits',async()=>{
 let time=1000,calls=0;
 await withServer({now:()=>time,vkFetch:async(url,init)=>{calls++;assert.equal(url,'https://api.vk.com/method/wall.get');assert.equal(init.method,'POST');assert.equal(init.body.get('v'),'5.131');return new Response(JSON.stringify({error:{error_code:5,error_msg:'sensitive-provider-message'}}));}},async base=>{
  const request=body=>fetch(base+'/api/vk/wall.get',{method:'POST',headers:{Authorization:'Bearer '+key,Origin:'https://scout.example'},body});
  const response=await request('access_token=test-placeholder&owner_id=-42&count=20');assert.equal(response.status,200);const raw=await response.text();assert(!raw.includes('sensitive-provider-message'));assert.equal(calls,1);
  assert.equal((await request('access_token=test-placeholder')).status,429);time+=500;
  assert.equal((await request('access_token=test-placeholder&target=https://evil.example')).status,400);
  assert.equal((await request('access_token=test-placeholder&count=1000')).status,400);
  assert.equal((await request('access_token='+('x'.repeat(20000)))).status,413);assert.equal(calls,1);
 });
});
test('backend returns explicit upstream invalid JSON/timeout failures',async()=>{
 for(const vkFetch of [async()=>new Response('{bad'),async()=>{throw Error('sensitive-token');}])await withServer({vkFetch},async base=>{
 const response=await fetch(base+'/api/vk/users.get',{method:'POST',headers:{Authorization:'Bearer '+key},body:'access_token=test-placeholder'});assert.equal(response.status,502);assert(!(await response.text()).includes('sensitive-token'));
 });
});
