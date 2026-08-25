import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { findFirstPassingSeed } from './graft-evaluator.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const first = Number(args.get('--first') ?? 0);
const last = Number(args.get('--last') ?? 999);
const output = args.get('--output') ?? null;
if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first) {
  throw new Error('usage: node graft-search.mjs --first <non-negative integer> --last <integer> [--output <file>]');
}

// Gate A is a semantic invariant rather than a seed predicate. Run it in the
// same reproducible command and fail the search if any fixture or oracle check fails.
execFileSync(process.execPath, ['graft-fixtures.mjs'], { stdio: 'pipe' });
const search = findFirstPassingSeed({ first, last });
if (search.result) search.result.gateA = true;
const document = {
  schema: 'exp-04-graft-search-v1',
  command: `node graft-search.mjs --first ${first} --last ${last}${output ? ` --output ${output}` : ''}`,
  generator: {
    seedDomain: `${first}..${last} (ascending)`,
    stoppingRule: 'Stop at the first all-gate pass. In ascending enumeration this proves minimum seed in the declared domain.',
    source: 'graft-evaluator.mjs:generateSeed',
  },
  elapsedMs: search.elapsedMs,
  fixtures: {
    command: 'node graft-fixtures.mjs',
    passed: true,
  },
  aggregate: search.aggregate,
  selected: search.result,
};
const text = `${JSON.stringify(document, null, 2)}\n`;
if (output) await writeFile(output, text, 'utf8');
process.stdout.write(text);
