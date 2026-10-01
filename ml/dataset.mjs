import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Documents and all their derivatives stay in one split. Test topics are absent from training.
const families=[
 ['battery','battery cells','cycles','The engineering group tests battery durability.'],
 ['crop','seedlings','surviving plants','The agriculture team studies plant growth.'],
 ['solar','solar panels','kilowatt hours','The energy team monitors solar output.'],
 ['river','river sensors','readings','The water team monitors river conditions.'],
 ['material','alloy samples','stress tests','The laboratory studies new materials.'],
 ['acoustic','acoustic sensors','recordings','The sound lab studies environmental noise.'],
 ['marine','coral sites','live colonies','The marine team monitors coral health.'],
 ['health','air sensors','measurements','The air quality team monitors urban conditions.'],
];
const names=['Alder','Birch','Cedar','Dahlia','Elm','Fern','Grove','Hazel','Iris','Juniper'];
export function generate(){
 const rows=[];
 for(let d=0;d<families.length;d++)for(let j=0;j<names.length;j++){
  const [family,item,unit,publicText]=families[d], name=`${names[j]}-${d+1}`,amount=17+d*9+j*3,percent=12+j*4+d,day=11+j;
  const split=d<5?'train':d===5?'validation':'test';
  const source=`The ${name} study measured ${amount} ${unit} from ${item}. Output declined by ${percent} percent. The team will halt the trial on ${day} October. This result is restricted to approved collaborators.`;
  const candidates=[
   ['copy',`The ${name} study measured ${amount} ${unit} from ${item}.`,1],
   ['excerpt',`Output declined by ${percent} percent. The team will halt the trial on ${day} October.`,1],
   ['paraphrase',d<6?`${name} reported ${amount} ${unit}; the experiment stops on October ${day} after a ${percent}% drop.`:`A decrease of ${percent}% was observed in ${name}. Work ends October ${day}, with ${amount} ${unit} logged.`,1],
   ['partial',d<6?`The ${name} experiment is being stopped on October ${day}.`:`October ${day} is the final day of work for ${name}.`,1],
   ['public',publicText,0],
   ['related',`The ${name} study investigates ${item}. Its methodology is public, but results and trial dates have not been released.`,0],
   ['wrong_record',`The ${names[(j+3)%10]}-other study measured ${amount+80} ${unit}. Output increased by ${percent+11} percent. Work continues until ${day} December.`,0],
   ['denied',`Access to ${name} has been removed. Contact the investigator to request permission.`,0],
  ];
  for(const [kind,candidate,label] of candidates)rows.push({id:`${family}-${j}-${kind}`,documentId:`${family}-${j}`,family,split,kind,source,candidate,label});
 }
 return rows;
}
const rows=generate();
fs.mkdirSync(path.join(root,'public/research'),{recursive:true});
fs.writeFileSync(path.join(root,'public/research/dataset.jsonl'),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(`Wrote ${rows.length} pairs from ${new Set(rows.map(x=>x.documentId)).size} source documents.`);
