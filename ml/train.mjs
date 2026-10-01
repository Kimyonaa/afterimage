import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as tf from '@tensorflow/tfjs';
import {pipeline,env} from '@huggingface/transformers';
import {generate} from './dataset.mjs';
import {pairFeatures,exact,fuzzy,metrics,chooseThreshold,forward} from './features.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'public/research');
const cache=path.join(root,'ml/cache');fs.mkdirSync(cache,{recursive:true});
const seed=42,epochs=50;
const rows=generate();
// Read fixture text directly from an exported JSON generated from the TypeScript fixture module.
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'ml/fixtures.json'),'utf8'));
const texts=[...new Set([...rows.flatMap(r=>[r.source,r.candidate]),...fixtures.flatMap(c=>[c.source,c.search,c.activity,c.publicText]),'Your access to this document has been removed.'])];
let embeddings={};const cached=path.join(cache,'embeddings.json');
if(fs.existsSync(cached))embeddings=JSON.parse(fs.readFileSync(cached,'utf8'));
env.cacheDir=path.join(cache,'models');
const missing=texts.filter(t=>!embeddings[t]);
if(missing.length){
 console.log(`Loading frozen MiniLM encoder for ${missing.length} passages.`);
 const encoder=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'});
 for(let i=0;i<missing.length;i+=16){const batch=missing.slice(i,i+16);const output=await encoder(batch,{pooling:'mean',normalize:true});const vectors=output.tolist();batch.forEach((t,j)=>embeddings[t]=vectors[j]);if(i%80===0){console.log(`Embedded ${Math.min(i+16,missing.length)}/${missing.length}`);fs.writeFileSync(cached,JSON.stringify(embeddings));}}
 fs.writeFileSync(cached,JSON.stringify(embeddings));
 await encoder.dispose();
}
await tf.setBackend('cpu');await tf.ready();
const groups={train:rows.filter(r=>r.split==='train'),validation:rows.filter(r=>r.split==='validation'),test:rows.filter(r=>r.split==='test')};
const features=r=>pairFeatures(embeddings[r.source],embeddings[r.candidate],r.source,r.candidate);
const xs=tf.tensor2d(groups.train.map(features)),ys=tf.tensor2d(groups.train.map(r=>[r.label]));
const vx=tf.tensor2d(groups.validation.map(features)),vy=tf.tensor2d(groups.validation.map(r=>[r.label]));
const model=tf.sequential();
model.add(tf.layers.dense({inputShape:[xs.shape[1]],units:32,activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed})}));
model.add(tf.layers.dense({units:16,activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed:seed+1})}));
model.add(tf.layers.dense({units:1,activation:'sigmoid',kernelInitializer:tf.initializers.glorotUniform({seed:seed+2})}));
model.compile({optimizer:tf.train.adam(.002),loss:'binaryCrossentropy'});
console.log(`Training pair classifier: ${xs.shape[1]} → 32 → 16 → 1`);
let bestLoss=Infinity,bestWeights=null,bestEpoch=0;
await model.fit(xs,ys,{epochs,batchSize:32,shuffle:false,validationData:[vx,vy],callbacks:{onEpochEnd:async(epoch,logs)=>{if(logs.val_loss<bestLoss){bestLoss=logs.val_loss;bestEpoch=epoch+1;bestWeights?.forEach(w=>w.dispose());bestWeights=model.getWeights().map(w=>w.clone());}if(epoch%10===0)console.log(`Epoch ${epoch+1}: val loss ${logs.val_loss.toFixed(4)}`);}}});
model.setWeights(bestWeights);
const weights=model.getWeights();const layers=[];for(let i=0;i<weights.length;i+=2)layers.push({weights:weights[i].arraySync(),bias:weights[i+1].arraySync()});
const neural=r=>forward(features(r),{layers});
const detectors=[['Exact passage',(r)=>exact(r.source,r.candidate)],['Token containment',(r)=>fuzzy(r.source,r.candidate)],['Neural pair classifier',neural]];
const models=detectors.map(([name,fn])=>{const t=chooseThreshold(groups.validation.map(r=>r.label),groups.validation.map(fn));return {name,...metrics(groups.test.map(r=>r.label),groups.test.map(fn),t)};});
const threshold=models[2].threshold;
const artifact={schemaVersion:1,encoder:'Xenova/all-MiniLM-L6-v2',dtype:'q8',pooling:'mean',normalize:true,dimension:384,featureOrder:'abs(a-b), a*b, tokenContainment, exact',threshold,layers};
fs.writeFileSync(path.join(out,'model.json'),JSON.stringify(artifact));
const fixtureEmbeddings=Object.fromEntries(texts.filter(t=>!rows.some(r=>r.source===t||r.candidate===t)).map(t=>[t,embeddings[t]]));
fs.writeFileSync(path.join(out,'fixture-embeddings.json'),JSON.stringify(fixtureEmbeddings));
const benchmark={status:'complete',note:'Measured on 160 synthetic test pairs from two held-out topic families. These results do not measure performance on real websites.',seed,epochs,bestEpoch,counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),architecture:'Frozen, quantized MiniLM-L6 sentence embeddings (384 dimensions), followed by a trained 770 → 32 → 16 → 1 neural pair classifier. Inputs include embedding differences, products, and two lexical baseline features. The transformer itself was not fine-tuned.',split:'50 source documents for training, 10 for validation, and 20 for testing. Every derivative stays with its source. Marine and air-quality topics are held out; test paraphrases use different scaffolding, but other template families are shared.',models,limitations:['Synthetic templates and a small sample can exaggerate generalization. No real-world security accuracy is claimed.','Labels indicate source-content correspondence under the fixture policy, not formal entailment or a universal definition of confidentiality.','The neural head includes lexical features; an ablation is needed to establish the transformer’s incremental value.','No numeric contradiction benchmark, multilingual evaluation, image encoder, or browser-cache inspection is included.','Thresholds use validation data; scores are uncalibrated. False positives and false negatives require human review.'],encoder:artifact.encoder};
fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify(benchmark,null,2));
fs.writeFileSync(path.join(out,'test-predictions.jsonl'),groups.test.map(r=>JSON.stringify({...r,scores:Object.fromEntries(detectors.map(([n,f])=>[n,f(r)]))})).join('\n')+'\n');
console.log(JSON.stringify(benchmark,null,2));
// Assert that the portable exported network reproduces TensorFlow inference.
const check=groups.test.slice(0,5);const tx=tf.tensor2d(check.map(features));const predicted=model.predict(tx).dataSync();
if(check.some((r,i)=>Math.abs(neural(r)-predicted[i])>1e-5))throw new Error('Export parity failed');
console.log('Export parity passed. Model and measured results saved.');
model.dispose();xs.dispose();ys.dispose();vx.dispose();vy.dispose();tx.dispose();bestWeights?.forEach(w=>w.dispose());
