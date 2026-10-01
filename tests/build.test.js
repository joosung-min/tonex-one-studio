import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
await promisify(execFile)(process.execPath,['scripts/build-pages.js'],{cwd:root});
const html=await readFile(new URL('index.html',dist),'utf8');
const worker=await readFile(new URL('sw.js',dist),'utf8');
const files=await readdir(dist,{recursive:true});
test('production deployment includes only bundled assets and required static files',async()=>{
 const assets=files.filter(file=>file.startsWith('assets/'));assert.equal(assets.length,3);
 assert.ok(assets.every(file=>/^assets\/(app|theme|style)-[A-Z0-9]+\.(js|css)$/.test(file)));
 assert.ok(!files.some(file=>/^(src|tests|scripts|node_modules)\//.test(file)||/\.map$/.test(file)||/package.*json|README/.test(file)));
 assert.doesNotMatch(html,/\.\/src\//);
 for(const file of ['LICENSE','THIRD_PARTY_LICENSES.txt','licenses/Apache-2.0.txt'])assert.ok(files.includes(file));
 assert.match(await readFile(new URL('LICENSE',dist),'utf8'),/^MIT License/);
 for(const file of assets)assert.doesNotMatch(await readFile(new URL(file,dist),'utf8'),/sourceMappingURL|sourceURL/);
 const app=await readFile(new URL(assets.find(file=>file.startsWith('assets/app-')),dist),'utf8');
 assert.match(app,/\.\.\/sw\.js/);const sourceFiles=(await readdir(new URL('src/',root))).filter(file=>file.endsWith('.js'));
 const sourceSize=(await Promise.all(sourceFiles.map(file=>readFile(new URL('src/'+file,root),'utf8')))).reduce((size,text)=>size+text.length,0);assert.ok(app.length<sourceSize);
});
for(const prefix of ['/','/txone-studio/'])test(`production URLs and offline cache stay within ${prefix}`,async()=>{
 const base=new URL(prefix,'https://example.github.io');
 for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  const url=new URL(match[1],base);if(url.origin!==base.origin)continue;
  assert.ok(url.pathname.startsWith(prefix));const file=url.pathname.slice(prefix.length);if(file)assert.ok(files.includes(file),file);
 }
 const handlers={},added=[],deleted=[],matches=[];let cacheName;
 const appPrefix=`tonex-studio:${prefix}:`;
 const caches={open:async name=>{cacheName=name;return {addAll:async urls=>added.push(...urls)};},keys:async()=>[cacheName,appPrefix+'v16','tonex-studio:/unrelated/:v16'],delete:async key=>deleted.push(key),match:async(url,options)=>{matches.push({url,options});return String(url).endsWith('index.html')?'offline HTML':undefined;}};
 vm.runInNewContext(worker,{URL,Response,self:{location:{href:new URL('sw.js',base).href},addEventListener:(name,handler)=>handlers[name]=handler},caches,fetch:async()=>{throw Error('offline');}});
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.ok(cacheName.startsWith(appPrefix+'release-'));
 assert.ok(added.every(url=>url.startsWith(base.href)));assert.ok(added.filter(url=>url.includes('/assets/')).length===3);
 for(const url of added){const file=new URL(url).pathname.slice(prefix.length);if(file)assert.ok(files.includes(file));}
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,[appPrefix+'v16']);
 let response;handlers.fetch({request:{url:base.href,method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await response,'offline HTML');assert.ok(matches.every(entry=>entry.options.cacheName===cacheName));
 let handled=false;handlers.fetch({request:{url:'https://other.example/',method:'GET'},respondWith:()=>handled=true});assert.equal(handled,false);
});
