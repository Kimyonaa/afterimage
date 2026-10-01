import fs from 'node:fs';
import {cases} from '../lib/afterimage/fixtures.ts';
fs.writeFileSync(new URL('../ml/fixtures.json',import.meta.url),JSON.stringify(cases,null,2));
