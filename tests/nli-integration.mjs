import assert from 'node:assert/strict';
const base='http://127.0.0.1:8765';
const health=await fetch(`${base}/health`);assert.equal((await health.json()).ready,true);
async function compare(body){return fetch(`${base}/compare`,{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://127.0.0.1:5173'},body:JSON.stringify(body)});}
const source='The meeting starts at nine in the morning.',candidate='The meeting begins at 9 am.';
let r=await compare({source,candidate,permitted:false,publicApproved:false});assert.equal(r.status,200);let result=await r.json();assert.equal(result.flagged,true);assert.equal(result.execution.startsWith('Live local'),true);
r=await compare({source,candidate,permitted:true});assert.equal((await r.json()).flagged,false);
r=await compare({source,candidate,publicApproved:true});assert.equal((await r.json()).flagged,false);
r=await compare({source,candidate:'The meeting starts at noon.'});assert.equal((await r.json()).flagged,false);
assert.equal((await compare({source:'',candidate})).status,400);
assert.equal((await compare({source:'one '.repeat(1000),candidate})).status,400);
assert.equal((await fetch(`${base}/compare`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({source,candidate})})).status,403);
assert.equal((await fetch(`${base}/compare`,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({source,candidate})})).status,415);
console.log('Live NLI: entailment, contradiction, authorization, public exception, input limits, origin and content-type checks passed.');
