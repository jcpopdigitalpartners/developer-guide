import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output=mkdtempSync(join(tmpdir(),'playbook-audio-'));
try {
 const compile=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','lib/audio-controller.ts','--target','ES2022','--module','esnext','--moduleResolution','bundler','--lib','DOM,ES2022','--skipLibCheck','--outDir',output],{stdio:'inherit'});
 if(compile.status!==0)process.exitCode=compile.status||1;
 else {
  writeFileSync(join(output,'package.json'),'{"type":"module"}');
  const result=spawnSync(process.execPath,['--test',resolve('tests/audio-controller.test.mjs')],{stdio:'inherit',env:{...process.env,PLAYER_TEST_MODULE:pathToFileURL(join(output,'audio-controller.js')).href}});
  process.exitCode=result.status||0;
 }
} finally { rmSync(output,{recursive:true,force:true}); }
