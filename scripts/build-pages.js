import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'dist');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of ['index.html','manifest.webmanifest','sw.js','THIRD_PARTY_LICENSES.txt','LICENSE'])await copyFile(path.join(root,file),path.join(output,file));
for(const directory of ['src','public','licenses'])await cp(path.join(root,directory),path.join(output,directory),{recursive:true});
console.log('GitHub Pages files prepared in dist/');
