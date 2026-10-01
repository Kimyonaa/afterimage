import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AutoTokenizer,AutoModelForSequenceClassification,env} from '@huggingface/transformers';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const MODEL_ID='Xenova/nli-deberta-v3-xsmall';
export const THRESHOLD=.8; // Fixed before the fresh challenge set is evaluated; never tuned on it.
export async function loadNLI(){
 env.cacheDir=path.join(root,'ml/cache/models');
 const tokenizer=await AutoTokenizer.from_pretrained(MODEL_ID);
 const model=await AutoModelForSequenceClassification.from_pretrained(MODEL_ID,{dtype:'q8'});
 const labels=model.config.id2label;
 const entailmentIndex=Object.entries(labels).find(([,v])=>String(v).toLowerCase()==='entailment')?.[0];
 if(entailmentIndex===undefined)throw new Error('Model label mapping does not explicitly identify entailment.');
 return {labels,dispose:()=>model.dispose(),async compare(source,candidate){
  if(typeof source!=='string'||typeof candidate!=='string'||!source.trim()||!candidate.trim())throw new Error('Both passages are required.');
  if(source.length>4000||candidate.length>4000)throw new Error('Keep each passage under 4,000 characters.');
  const inputs=await tokenizer(source,{text_pair:candidate,padding:true,truncation:false});
  if(inputs.input_ids.dims[1]>512)throw new Error('These passages exceed the model’s 512-token limit. Shorten them; no text was truncated.');
  const start=performance.now(),output=await model(inputs),logits=Array.from(output.logits.data),max=Math.max(...logits),exp=logits.map(v=>Math.exp(v-max)),sum=exp.reduce((a,b)=>a+b,0);
  const probabilities=Object.fromEntries(exp.map((v,i)=>[String(labels[i]).toLowerCase(),v/sum]));
  return {score:probabilities.entailment,probabilities,threshold:THRESHOLD,contentMatch:probabilities.entailment>=THRESHOLD,model:MODEL_ID,elapsedMs:Math.round(performance.now()-start),tokens:inputs.input_ids.dims[1],note:'Pretrained entailment estimate, not a calibrated leakage probability. Permission and public-information policy must be evaluated separately.'};
 }};
}
