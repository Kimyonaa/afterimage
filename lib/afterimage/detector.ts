export type Model = {layers:{weights:number[][];bias:number[]}[];threshold:number;featureMode?:string};
const stop=new Set('a an the and or of to in on at by for is are was were be been being it its this that these those will with from as has have had after before until'.split(' '));
export function tokens(text:string){return text.toLowerCase().match(/[a-z0-9]+/g)?.filter(x=>!stop.has(x))??[];}
export function exact(source:string,candidate:string){const norm=(s:string)=>s.toLowerCase().replace(/\s+/g,' ').trim();return candidate.trim().length>20&&norm(source).includes(norm(candidate))?1:0;}
export function containment(source:string,candidate:string){const a=new Set(tokens(source)),b=new Set(tokens(candidate));return b.size?[...b].filter(x=>a.has(x)).length/b.size:0;}
export function infer(source:string,candidate:string,embeddings:Record<string,number[]>,model:Model){
 const a=embeddings[source],b=embeddings[candidate];if(!a||!b||!model.layers.length)throw new Error('The encoder does not contain this passage. Use the local inference script for arbitrary text.');
 let x=[...a.map((v,i)=>Math.abs(v-b[i])),...a.map((v,i)=>v*b[i]),containment(source,candidate),exact(source,candidate)];
 if(model.featureMode==='embedding-only')x=x.slice(0,-2);
 if(model.featureMode==='lexical-only')x=x.slice(-2);
 for(let i=0;i<model.layers.length;i++){const {weights,bias}=model.layers[i];x=bias.map((v,j)=>{const sum=v+x.reduce((s,k,n)=>s+k*weights[n][j],0);return i===model.layers.length-1?1/(1+Math.exp(-sum)):Math.max(0,sum);});}return x[0];
}
export function isFinding(permitted:boolean,status:number,score:number,threshold:number){return !permitted&&status===200&&score>=threshold;}

export function cosine(source:string,candidate:string,embeddings:Record<string,number[]>){const a=embeddings[source],b=embeddings[candidate];if(!a||!b)throw new Error('Missing fixture embedding');return Math.max(0,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)));}
