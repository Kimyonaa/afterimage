import http from 'node:http';
import {loadNLI,MODEL_ID} from './nli.mjs';
const port=Number(process.env.AFTERIMAGE_MODEL_PORT??8765);
const allowed=new Set(['http://127.0.0.1:5173','http://localhost:5173']);
let engine,loadError,working=false;
function reply(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&!allowed.has(origin)){reply(res,403,{error:'Origin not allowed'});return;}
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.url==='/health'&&req.method==='GET'){reply(res,200,{ready:!!engine,model:MODEL_ID,error:loadError??null,localOnly:true});return;}
 if(req.url!=='/compare'||req.method!=='POST'){reply(res,404,{error:'Not found'});return;}
 if(!req.headers['content-type']?.startsWith('application/json')){reply(res,415,{error:'Use application/json'});return;}
 if(!engine){reply(res,503,{error:loadError??'The local model is loading. Try again shortly.'});return;}
 if(working){reply(res,429,{error:'The model is processing another passage. Try again shortly.'});return;}
 working=true;
 let body='',size=0;
 try{for await(const chunk of req){size+=chunk.length;if(size>20000){reply(res,413,{error:'Request too large'});return;}body+=chunk;}
 const input=JSON.parse(body);
 const result=await engine.compare(input.source,input.candidate);
 const permitted=input.permitted===true,publicApproved=input.publicApproved===true;
 reply(res,200,{...result,permitted,publicApproved,flagged:!permitted&&!publicApproved&&result.contentMatch,execution:'Live local ONNX inference; no passage text sent to a remote service.'});
 }catch(e){reply(res,400,{error:e instanceof Error?e.message:'Invalid request'});}finally{working=false;}
});
server.listen(port,'127.0.0.1',()=>console.log(`Afterimage local model: http://127.0.0.1:${port}`));
loadNLI().then(value=>{engine=value;console.log('DeBERTa is ready. Passage text is processed locally.');}).catch(error=>{loadError='The model could not load. Check the terminal and network access for the first download.';console.error(error.message);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await engine?.dispose();process.exit(0);}));
