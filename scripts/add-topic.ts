import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { topicSource } from './markdown-source.ts';
import { registerTopic } from './topic-registry.ts';

/**
 * Registers a topic: `node scripts/add-topic.ts <id> [--from <draft.md>]`.
 * With --from, the draft is copied to topics/<id>/README.md first (never overwriting).
 * Without it, the README must already exist and have valid front matter; the ID is then
 * appended to topics/topics.json. The next build regenerates the README topic table.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : undefined;
const id = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--from');
const fail = (message: string) => { console.error(`add-topic: ${message}`); process.exit(1); };
if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail('Usage: node scripts/add-topic.ts <descriptive-kebab-case-id> [--from <draft.md>]');
const readme = resolve(root, 'topics', id!, 'README.md');
const present = await access(readme).then(() => true, () => false);

if (from) {
  if (present) fail(`topics/${id}/README.md already exists; not overwriting it.`);
  await mkdir(dirname(readme), { recursive: true });
  await copyFile(resolve(from), readme);
  console.log(`Copied ${from} to topics/${id}/README.md. Prepare it for publication, then run this command again without --from to register it.`);
  process.exit(0);
}
if (!present) fail(`topics/${id}/README.md does not exist. Use --from <draft.md> to start from a draft.`);
try { topicSource(await readFile(readme, 'utf8'), `${id}/README.md`); }
catch (error) { fail(`${(error as Error).message}\nFix the front matter before registering the topic.`); }

const registryPath = resolve(root, 'topics/topics.json');
const before = await readFile(registryPath, 'utf8');
const after = registerTopic(before, id!);
if (after === before) console.log(`${id} is already registered.`);
else {
  await writeFile(registryPath, after);
  console.log(`Registered ${id} as topic ${(JSON.parse(after) as { topics: string[] }).topics.length}. Run npm run build to validate it and refresh the README topic table.`);
}
