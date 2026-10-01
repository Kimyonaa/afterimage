import fs from 'node:fs';
const records=[
 ['well','The Vega survey detected lead in well 12 at 48 parts per billion. Drinking from this well is prohibited until 6 June.',
  'Water from well number 12 contained 48 ppb of lead.','Well 12 cannot be used for drinking before June 6.','The Vega survey found no lead in well 12.','Lead testing can help communities assess drinking-water quality.'],
 ['shipment','The sealed shipment contains 230 sapphire samples. It leaves the north warehouse at 04:30 on Tuesday.',
  'Two hundred and thirty sapphire specimens are in the sealed consignment.','The consignment departs the northern warehouse at half past four on Tuesday morning.','The shipment contains only twenty sapphire samples.','Warehouses often schedule deliveries outside business hours.'],
 ['excavation','Excavators discovered a bronze seal beneath chamber seven. The seal carries the name of Queen Amara.',
  'A seal made of bronze was found under the seventh chamber.','Queen Amara is named on the newly discovered seal.','The excavators found a silver coin and no seal beneath chamber seven.','Archaeologists use inscriptions to study historical societies.'],
 ['turbine','Turbine C stopped because its bearing cracked. Repairs require a replacement bearing costing 76000 rupees.',
  'A fractured bearing caused turbine C to shut down.','The replacement bearing needed for the repair costs seventy-six thousand rupees.','Turbine C stopped because its fuel tank was empty; its bearing is intact.','Turbines need routine maintenance to operate reliably.'],
 ['nest','The falcon nest is on the roof of the abandoned east station. It contains three eggs.',
  'Three eggs were counted in the falcons’ nest.','The deserted station to the east has a falcon nest on its roof.','The falcon nest contains six eggs.','Falcons sometimes nest on human-made structures.'],
 ['budget','The council approved 1.2 million rupees for the footbridge. Construction must begin before 8 August.',
  'Twelve lakh rupees were approved for building the footbridge.','Work on the footbridge has to start earlier than August 8.','The council rejected all funding for the footbridge.','Councils may review infrastructure funding requests each year.'],
 ['manuscript','The unpublished manuscript names Elian as the anonymous donor. Publication is scheduled for 17 February.',
  'Elian is identified as the donor in the unreleased manuscript.','The manuscript is due to be published on February 17.','The manuscript identifies Nara, not Elian, as the donor.','Publishers establish schedules for releasing new manuscripts.'],
 ['reservoir','Reservoir D lost 18 percent of its stored water during April. An underground fracture caused the loss.',
  'A fracture beneath the ground caused water to escape from reservoir D.','Eighteen percent of reservoir D’s stored water was lost in April.','Reservoir D gained eighteen percent more water during April.','Water storage levels can fluctuate across seasons.'],
 ['prototype','The Kestrel prototype weighs 620 grams. Its battery lasts nine hours under continuous load.',
  'Kestrel runs continuously for nine hours on its battery.','The prototype’s mass is six hundred and twenty grams.','The Kestrel prototype weighs two kilograms.','Battery life varies with operating conditions.'],
 ['audit','The audit found eleven duplicate payments to the Orin supplier. The total overpayment was 94000 rupees.',
  'Orin received eleven payments that were duplicates.','The supplier was overpaid ninety-four thousand rupees in total.','The audit confirmed that Orin received no duplicate payments.','Audits can identify mistakes in supplier payments.'],
 ['greenhouse','Greenhouse B contains 85 surviving seedlings. A heater malfunction destroyed the remaining 15.',
  'Fifteen seedlings were killed by a faulty heater.','Eighty-five seedlings remain alive in greenhouse B.','All one hundred seedlings in greenhouse B survived.','Temperature regulation is important when growing seedlings.'],
 ['ferry','The last ferry departs at 19:10. Repairs will close the eastern pier throughout Wednesday.',
  'The eastern pier is unavailable all Wednesday because of repairs.','The final ferry leaves at ten past seven in the evening.','The last ferry departs at 06:00 in the morning.','Ferry schedules may change during maintenance work.']
];
export const challenge=records.flatMap(([id,source,...candidates])=>candidates.map((candidate,i)=>({id:`fresh-${id}-${i}`,documentId:`fresh-${id}`,source,candidate,label:i<2?1:0,kind:['paraphrase','partial_fact','contradiction','related_public'][i],provenance:'Manually authored fictional challenge; no project model trained on these rows.'})));
fs.writeFileSync(new URL('../public/research/challenge.jsonl',import.meta.url),challenge.map(r=>JSON.stringify(r)).join('\n')+'\n');
