import {mkdir,copyFile,cp,rm,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build,transform} from 'esbuild';
import {APP_VERSION} from '../src/version.js';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'dist');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
const bundle=await build({
  absWorkingDir:root,entryPoints:{app:'src/app.js',theme:'src/theme.js',style:'src/style.css'},
  outdir:path.join(output,'assets'),entryNames:'[name]-[hash]',bundle:true,minify:true,
  format:'esm',platform:'browser',target:'es2022',sourcemap:false,legalComments:'none',write:false,
  banner:{js:'/*! ToneX One Studio: MIT. Third-party notices: ../THIRD_PARTY_LICENSES.txt */',css:'/*! ToneX One Studio: MIT. Third-party notices: ../THIRD_PARTY_LICENSES.txt */'}
});
await mkdir(path.join(output,'assets'));
for(const file of bundle.outputFiles)await writeFile(file.path,file.contents);
const assets=bundle.outputFiles.map(file=>path.relative(output,file.path).split(path.sep).join('/'));
const asset=name=>assets.find(file=>file.startsWith(`assets/${name}-`));
for(const page of ['index.html','getting-started.html']){
let html=await readFile(path.join(root,page),'utf8');
for(const [source,name] of [['app.js','app'],['theme.js','theme'],['style.css','style']])html=html.replace(`./src/${source}`,`./${asset(name)}`);
await writeFile(path.join(output,page),html);
}
for(const file of ['manifest.webmanifest','THIRD_PARTY_LICENSES.txt','LICENSE'])await copyFile(path.join(root,file),path.join(output,file));
for(const directory of ['public','licenses'])await cp(path.join(root,directory),path.join(output,directory),{recursive:true});
const revision=createHash('sha256').update(bundle.outputFiles.map(file=>file.text).join('\n')).digest('hex').slice(0,12);
const shell=['./','index.html','getting-started.html',...assets,'manifest.webmanifest','public/icon.svg','LICENSE','THIRD_PARTY_LICENSES.txt','licenses/Apache-2.0.txt'];
const worker=(await readFile(path.join(root,'sw.js'),'utf8'))
  .replace(/const CACHE=.*?;/,`const CACHE=PREFIX+'release-${APP_VERSION}-${revision}';`)
  .replace(/const SHELL=\[.*?\]\.map/,`const SHELL=${JSON.stringify(shell)}.map`);
await writeFile(path.join(output,'sw.js'),(await transform(worker,{minify:true,target:'es2022',sourcemap:false})).code);
console.log(`Built ToneX One Studio ${APP_VERSION}: ${assets.length} minified assets, no source maps.`);
