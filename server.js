const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (u.pathname === '/health') { res.writeHead(200, {'content-type':'application/json'}); return res.end(JSON.stringify({ok:true,game:'DICE 6'})); }
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file,(err,data)=>{
    if (err) { res.writeHead(404, {'content-type':'text/plain'}); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, {'content-type': types[ext] || 'application/octet-stream','cache-control': ext === '.html' ? 'no-store' : 'public,max-age=3600'});
    res.end(data);
  });
});
server.listen(PORT,'0.0.0.0',()=>console.log(`DICE 6 running on port ${PORT}`));
