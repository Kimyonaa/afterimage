import { loadNLI } from './nli.mjs';
console.log('Loading pretrained DeBERTa entailment model…');
const engine = await loadNLI();
console.log('Label mapping:', engine.labels);
console.log(
  await engine.compare('The meeting starts at nine in the morning.', 'The meeting begins at 9 am.'),
);
console.log(
  await engine.compare('The meeting starts at nine in the morning.', 'The meeting starts at noon.'),
);
await engine.dispose();
