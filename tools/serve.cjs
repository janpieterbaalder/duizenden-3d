const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html', '.js':'text/javascript', '.svg':'image/svg+xml', '.ogg':'audio/ogg', '.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
  let requested;
  try { requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (requested==='/'?'/index.html':requested));
  if (!file.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file,(err,data)=>{
    if(err) { res.writeHead(404).end(); return; }
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(data);
  });
}).listen(8080,'127.0.0.1',()=>console.log('Duizenden: http://localhost:8080'));
