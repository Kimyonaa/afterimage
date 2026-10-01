import fs from 'node:fs';
import crypto from 'node:crypto';
import {pipeline,env} from '@huggingface/transformers';
import {loadNLI,THRESHOLD,MODEL_ID} from './nli.mjs';
import {challenge} from './challenge.mjs';
import {pairFeatures,exact,fuzzy,forward,metrics} from './features.mjs';
const out=new URL('../public/research/',import.meta.url),cache=new URL('./cache/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,out),'utf8'));
const original=read('benchmark.json'),models={'Neural pair classifier':read('model.json'),'Neural · embeddings only':read('model-embedding-only.json'),'Neural · lexical only':read('model-lexical-only.json')};
const protocol=read('nli-protocol.json');if(protocol.decisionThreshold!==THRESHOLD)throw new Error('Protocol and implementation threshold disagree.');
const embeddings=JSON.parse(fs.readFileSync(new URL('embeddings.json',cache),'utf8'));
env.cacheDir=new URL('models/',cache).pathname;
const texts=[...new Set(challenge.flatMap(r=>[r.source,r.candidate]))];
console.log('Encoding fresh challenge passages for the frozen baselines.');
const encoder=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'});
for(let i=0;i<texts.length;i+=16){const batch=texts.slice(i,i+16),vectors=(await encoder(batch,{pooling:'mean',normalize:true})).tolist();batch.forEach((t,j)=>embeddings[t]=vectors[j]);}
await encoder.dispose();
console.log('Evaluating pretrained NLI. The threshold is fixed at 0.8.');
const engine=await loadNLI(),predictions=[];
for(const r of challenge){const nli=await engine.compare(r.source,r.candidate),a=embeddings[r.source],b=embeddings[r.candidate],x=pairFeatures(a,b,r.source,r.candidate);const scores={'Exact passage':exact(r.source,r.candidate),'Token containment':fuzzy(r.source,r.candidate),'Frozen MiniLM cosine':Math.max(0,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)))};for(const [name,m] of Object.entries(models))scores[name]=forward(m.featureMode==='embedding-only'?x.slice(0,-2):m.featureMode==='lexical-only'?x.slice(-2):x,m);scores['DeBERTa entailment']=nli.score;predictions.push({...r,scores,nli:nli.probabilities});}
const thresholds=Object.fromEntries(original.models.map(m=>[m.name,m.threshold]));thresholds['DeBERTa entailment']=THRESHOLD;
const results=Object.entries(thresholds).map(([name,threshold])=>({name,...metrics(predictions.map(r=>r.label),predictions.map(r=>r.scores[name]),threshold)}));
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url),'utf8')),recordings={};
for(const c of fixtures){recordings[c.id]={source:c.source,passages:{}};for(const text of [...new Set([c.source,c.search,c.activity,c.publicText,'Your access to this document has been removed.'])])recordings[c.id].passages[text]=await engine.compare(c.source,text);}
await engine.dispose();
const report={schemaVersion:1,title:'Fresh paraphrase and contradiction challenge',corpus:'48 manually authored synthetic pairs from 12 source documents; 24 positive and 24 negative.',protocol,model:MODEL_ID,thresholds,models:results,byKind:Object.fromEntries(['paraphrase','partial_fact','contradiction','related_public'].map(kind=>[kind,Object.entries(thresholds).map(([name,t])=>{const group=predictions.filter(r=>r.kind===kind);return {name,...metrics(group.map(r=>r.label),group.map(r=>r.scores[name]),t)};})])),challengeSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('challenge.jsonl',out))).digest('hex'),predictions};
fs.writeFileSync(new URL('challenge-results.json',out),JSON.stringify(report,null,2));
fs.writeFileSync(new URL('nli-fixture-recordings.json',out),JSON.stringify({model:MODEL_ID,threshold:THRESHOLD,execution:'Recorded locally with pretrained q8 DeBERTa, not live model inference in the web server.',cases:recordings},null,2));
console.log(JSON.stringify(results,null,2));
console.log('Recorded fixture entailment:',Object.fromEntries(fixtures.map(c=>[c.id,Object.fromEntries(['search','activity','publicText'].map(k=>[k,recordings[c.id].passages[c[k]].score]))])));
