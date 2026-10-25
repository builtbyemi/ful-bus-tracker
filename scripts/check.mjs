import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const excluded=new Set(['node_modules','.git','.local-tools','analytics','artifacts','test-results','playwright-report']);
async function filesAt(directory='.') {
  const entries=await readdir(directory,{withFileTypes:true});
  const lists=await Promise.all(entries.filter(entry=>!excluded.has(entry.name)).map(async entry=>{
    const name=path.join(directory,entry.name);
    return entry.isDirectory()?(name===path.join('assets','vendor')?[]:filesAt(name)):[name];
  }));
  return lists.flat();
}
const files=await filesAt();
let checked=0;
for(const file of files) {
  if(/\.(js|mjs)$/.test(file)) {
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(result.status!==0)throw new Error(result.stderr);
    const source=await readFile(file,'utf8');
    if(!/^(tests|scripts)/.test(file) && /DRIVER_PASSWORDS|FulDriver00/.test(source))throw new Error('Legacy shared password found in '+file);
    checked++;
  }
  if(file.endsWith('.html')) {
    const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if(/^(https?:|data:|#|mailto:)/.test(match[1]))continue;
      const target=path.resolve(path.dirname(file),match[1].split(/[?#]/)[0]);
      try {await access(target);}catch{throw new Error(file+' references missing file '+match[1]);}
    }
    checked++;
  }
}
console.log('Syntax and local references checked in '+checked+' files.');
