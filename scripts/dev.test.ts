import test from 'node:test';
import assert from 'node:assert/strict';
import { buildError } from './dev.ts';

test('a failed build is reported by its message, not its stack trace', () => {
  const output = `file:///repo/scripts/markdown-source.ts:31
  if (topic.description.length > maxDescriptionLength) throw new Error(\`...\`);
                                                              ^

Error: my-idea/README.md: front matter "description" has 170 characters; keep it to 155 or fewer.
    at topicSource (file:///repo/scripts/markdown-source.ts:31:63)
    at file:///repo/scripts/build.ts:233:18

Node.js v24.21.0
`;
  assert.equal(buildError(output), 'my-idea/README.md: front matter "description" has 170 characters; keep it to 155 or fewer.');
  assert.equal(buildError('Error: first line\nsecond line\n    at x'), 'first line\nsecond line');
  assert.equal(buildError('something odd happened'), 'something odd happened');
});
