import {execFileSync} from 'node:child_process';import {mkdirSync,existsSync,symlinkSync,readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createServer} from 'vite';
const root=resolve('.original-ui');mkdirSync(root,{recursive:true});
const archive=execFileSync('git',['archive','700cad8709b76f07414048fce1b0c869f207d4ea'],{maxBuffer:20*1024*1024});execFileSync('tar',['-x','-C',root],{input:archive});
const bridge=resolve(root,'src/utils/tauriBridge.ts');writeFileSync(bridge,readFileSync(bridge,'utf8').replace(/^const BUILTIN_FREE_AI_KEY = .*;$/m,"const BUILTIN_FREE_AI_KEY = '';"));
if(!existsSync(resolve(root,'node_modules')))symlinkSync(resolve('node_modules'),resolve(root,'node_modules'),'dir');
const server=await createServer({root,server:{host:'127.0.0.1',port:5174,strictPort:true}});await server.listen();console.log('Original Scout UI available on port 5174');
