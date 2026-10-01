import assert from 'node:assert/strict';
const base=process.env.AFTERIMAGE_URL??'http://127.0.0.1:5173';
let cookie='';
async function action(action,caseId){const r=await fetch(`${base}/api/lab`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({action,caseId})});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];return r.json();}
async function surfaces(){return Promise.all(['document','search','activity','tab'].map(async name=>{const r=await fetch(`${base}/api/surface?name=${name}`,{headers:{Cookie:cookie}});return r.json();}));}
async function detect(observations,detector='neural'){return fetch(`${base}/api/detect`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({observations,detector})});}
for(const caseId of ['monsoon','orchid','fellowship']){
 await action('reset',caseId);let obs=await surfaces();let r=await detect(obs);assert.equal(r.status,200);assert.equal((await r.json()).findings.filter(f=>f.flagged).length,0);
 await action('revoke');obs=await surfaces();assert.equal(obs[0].status,403);assert.ok(obs.slice(1).every(o=>o.status===200&&!o.permitted));r=await detect(obs);assert.equal(r.status,200);const findings=(await r.json()).findings;assert.equal(findings.filter(f=>f.flagged).length,2);assert.equal(findings.find(f=>f.surface==='activity').flagged,false); // Document the measured model failure.
 for(const detector of ['fuzzy','exact','cosine','embedding','lexical']){r=await detect(obs,detector);assert.equal(r.status,200);}
 r=await detect(obs,'hybrid');assert.equal(r.status,200);assert.equal((await r.json()).findings.filter(f=>f.flagged).length,caseId==='monsoon'?3:2);
 await action('repair');r=await detect(obs);assert.equal(r.status,409);obs=await surfaces();r=await detect(obs);assert.equal(r.status,200);assert.equal((await r.json()).findings.filter(f=>f.flagged).length,0);
 r=await detect(obs,'hybrid');assert.equal((await r.json()).findings.filter(f=>f.flagged).length,0);
 console.log(`${caseId}: authorization, deliberate leaks, model miss, repair, stale-run rejection passed`);
}
const other=await fetch(`${base}/api/lab`);assert.equal((await other.json()).state.revoked,false);
assert.equal((await fetch(`${base}/api/surface?name=unknown`)).status,400);
console.log('Session isolation and invalid-surface handling passed.');
