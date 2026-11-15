// Run from the project root:  node tests/parity_test.mjs
// Checks: (1) JS engine reproduces the report, (2) JS and Python engines agree to 1e-6.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { plan, verify, runScenarios } from '../frontend/evaPlanner.js';

const scenario = JSON.parse(readFileSync(new URL('../scenarios/jezero_reference.json', import.meta.url)));
const js = plan(scenario);
const v = verify(js, scenario);
console.log(`JS verification: ${v.passed}/${v.total} checks passed`);
if (!v.all_pass) { console.log(v.checks.filter((c) => !c.pass)); process.exit(1); }

const py = JSON.parse(execFileSync('python3', ['backend/eva_planner.py', 'json'], { encoding: 'utf8' }));
let bad = 0;
const cmp = (a, b, path) => {
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > 1e-6) { console.log('DIFF', path, a, b); bad++; } }
  else if (a && typeof a === 'object' && b) { for (const k of Object.keys(a)) if (k in b) cmp(a[k], b[k], `${path}.${k}`); }
  else if (a !== b && typeof a !== 'object') { console.log('DIFF', path, a, b); bad++; }
};
cmp(js, py.plan, 'plan');
const sc = runScenarios(scenario);
sc.forEach((row, i) => cmp(row, py.scenarios[i], `scenario[${i}]`));
console.log(bad ? `${bad} parity differences` : 'Python and JS engines agree');
process.exit(bad ? 1 : 0);
