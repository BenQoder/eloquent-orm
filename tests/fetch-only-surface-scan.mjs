import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = [
  'src/Eloquent.ts',
  'src/relations/Relation.ts',
];

const requiredReadApis = [
  'where(conditions: Record<string, any>)',
  'orWhere(conditions: Record<string, any>)',
  'whereKey(id: any | any[])',
  'whereKeyNot(id: any | any[])',
  'withAggregate(',
  'withSum(',
  'withAvg(',
  'withMin(',
  'withMax(',
  'registerReadHelper(',
  'registerReadHelpers(',
];

const forbiddenPublicMutationMethods = [
  'insert',
  'update',
  'save',
  'create',
  'destroy',
  'increment',
  'decrement',
  'attach',
  'detach',
  'sync',
  'delete',
];

const source = files
  .map(file => readFileSync(join(root, file), 'utf8'))
  .join('\n');

const missing = requiredReadApis.filter(api => !source.includes(api));
if (missing.length > 0) {
  console.error('Missing required fetch/read APIs:', missing);
  process.exit(1);
}

const violations = [];
for (const name of forbiddenPublicMutationMethods) {
  const pattern = new RegExp(`^\\s*(?:async\\s+)?${name}\\(`, 'm');
  if (pattern.test(source)) {
    violations.push(name);
  }
}

if (violations.length > 0) {
  console.error('Forbidden native mutation methods found:', violations);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  scanned: files,
  requiredReadApis: requiredReadApis.length,
  forbiddenMutationMethods: forbiddenPublicMutationMethods.length,
}, null, 2));
