import {execFileSync} from 'node:child_process';
import {rmSync,mkdirSync,writeFileSync} from 'node:fs';
rmSync('.test-dist',{recursive:true,force:true});mkdirSync('.test-dist');
try {
 execFileSync('node_modules/.bin/tsc',['--ignoreConfig','--target','es2022','--module','commonjs','--moduleResolution','node','--ignoreDeprecations','6.0','--strict','--skipLibCheck','--rootDir','src','--outDir','.test-dist','src/scout/opportunity.ts','src/scout/persistence.ts','src/scout/discovery.ts','src/scout/crm.ts'],{stdio:'inherit'});
 writeFileSync('.test-dist/package.json',JSON.stringify({type:'commonjs'}));
 execFileSync(process.execPath,['tests/opportunity.mjs'],{stdio:'inherit'});
 execFileSync(process.execPath,['--test','tests/regression.mjs'],{stdio:'inherit'});
 execFileSync(process.execPath,['--test','tests/server.mjs','tests/engine.mjs'],{stdio:'inherit'});
 execFileSync('python3',['tests/sqlite_migration.py'],{stdio:'inherit'});
}finally{rmSync('.test-dist',{recursive:true,force:true});}
