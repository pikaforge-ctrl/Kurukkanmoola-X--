import {createServer} from 'node:http';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.glb':'model/gltf-binary','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const players=new Map(),messages=new Map();
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data));}
async function body(req){let s='';for await(const c of req)s+=c;try{return JSON.parse(s||'{}')}catch{return {}}}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost:8080');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type'}).end();return;}
 if(url.pathname==='/api/player'&&req.method==='POST'){const p=await body(req);if(!p.id||!p.name)return json(res,400,{error:'name required'});players.set(p.id,{id:p.id,name:String(p.name).slice(0,18),gender:p.gender||'other',x:Number(p.x)||0,z:Number(p.z)||0,score:Number(p.score)||0,last:Date.now()});return json(res,200,{ok:true});}
 if(url.pathname==='/api/state'&&req.method==='GET'){const self=url.searchParams.get('self');const now=Date.now();for(const [id,p] of players)if(now-p.last>15000)players.delete(id);return json(res,200,{players:[...players.values()],messages:messages.get(self)||[]});}
 if(url.pathname==='/api/players'&&req.method==='GET'){const self=url.searchParams.get('self');const now=Date.now();for(const [id,p] of players)if(now-p.last>15000)players.delete(id);return json(res,200,{players:[...players.values()].filter(p=>p.id!==self).map(({id,name,gender})=>({id,name,gender}))});}
 if(url.pathname==='/api/message'&&req.method==='POST'){const m=await body(req);if(!players.has(m.from)||!players.has(m.to)||m.from===m.to)return json(res,404,{ok:false});const arr=messages.get(m.to)||[];arr.push({from:m.from,text:String(m.text||'').slice(0,160),fromName:players.get(m.from)?.name||'Player',time:Date.now()});messages.set(m.to,arr.slice(-50));return json(res,200,{ok:true});}
 if(url.pathname==='/api/leaderboard'&&req.method==='GET'){const ranked=[...players.values()].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,50);return json(res,200,{players:ranked});}
 const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root.slice(0,-1)&&!path.startsWith(root)){res.writeHead(403).end();return;}const p=(await stat(path)).isDirectory()?resolve(path,'index.html'):path;const data=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
}catch(e){res.writeHead(404).end('Not found');}});
const preferred=Number(process.env.PORT||8080);
async function listenOn(port){
  return await new Promise((resolvePromise,reject)=>{
    const onError=(err)=>{server.off('listening',onListening);reject(err)};
    const onListening=async()=>{server.off('error',onError);await writeFile(new URL('./.kurukkanmoola-port',import.meta.url),String(port));console.log(`Kurukkanmoola X server is listening on 0.0.0.0:${port}`);resolvePromise(port)};
    server.once('error',onError);server.once('listening',onListening);server.listen(port,'0.0.0.0');
  });
}
async function start(){
  const ports=process.env.PORT?[preferred]:[preferred,...Array.from({length:10},(_,i)=>preferred+1+i)];
  for(const port of ports){try{await listenOn(port);return}catch(e){if(e.code!=='EADDRINUSE')throw e;}}
  console.error('No free port found. Tried:',ports.join(', '));process.exit(1);
}
start().catch(e=>{console.error(e);process.exit(1)});
