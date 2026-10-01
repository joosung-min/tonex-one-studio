import http from 'node:http';
import https from 'node:https';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.cwd(),process.argv[2]||'.'), port=Number(process.env.PORT||5173);
const types={'.xml':'application/xml','.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.txt':'text/plain'};
const handler=async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,`.${pathname.endsWith('/')?pathname+'index.html':pathname}`);
    const relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(s=>s.startsWith('.'))) {res.writeHead(403);return res.end('Forbidden');}
    if(!(await stat(file)).isFile())throw Error('Not a file');
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Permissions-Policy':'usb=(self), serial=(self)'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
};
const server=process.env.TLS_CERT&&process.env.TLS_KEY?https.createServer({cert:await readFile(process.env.TLS_CERT),key:await readFile(process.env.TLS_KEY)},handler):http.createServer(handler);
server.listen(port,'0.0.0.0',()=>console.log(`TXOne-Studio: ${process.env.TLS_CERT?'https':'http'}://localhost:${port}`));
