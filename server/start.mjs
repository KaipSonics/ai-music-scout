import {createScoutServer} from './app.mjs';
const port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1';
const server=createScoutServer({accessKey:process.env.SCOUT_ACCESS_KEY,allowedOrigins:(process.env.SCOUT_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)});
server.requestTimeout=20000;server.headersTimeout=10000;server.listen(port,host,()=>console.log('ASV Scout API is listening on port '+port));
