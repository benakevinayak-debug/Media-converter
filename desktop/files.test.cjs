const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { MediaFiles } = require('./files.cjs');

test('folder import is recursive, deduplicates selections, skips links and non-media, and reports missing files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mediaconvert-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'sub'));
  await fs.writeFile(path.join(root, 'clip.MP4'), 'original');
  await fs.writeFile(path.join(root, 'sub', 'संगीत.wav'), 'audio');
  await fs.writeFile(path.join(root, 'notes.txt'), 'ignore');
  if (process.platform !== 'win32') await fs.symlink(root, path.join(root, 'sub', 'loop'));
  const media = new MediaFiles();
  const result = await media.collect([root, path.join(root, 'clip.MP4'), path.join(root, 'missing.mp4')]);
  assert.equal(result.files.length, 2);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.files.find(f => f.name.endsWith('.wav')).folder, path.join(root, 'sub'));
  assert.equal((await media.read(result.files[0].id)).toString(), 'original');
  assert.equal((await media.collect([root])).files[0].id, result.files[0].id);
});

test('save stays beside the source, never overwrites originals or existing outputs, and rejects invalid requests', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mediaconvert-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const original = path.join(root, 'my clip.wav');
  await fs.writeFile(original, 'keep original');
  await fs.writeFile(path.join(root, 'my clip-converted.wav'), 'keep previous');
  const media = new MediaFiles();
  const { files: [file] } = await media.collect([original]);
  const outputs = await Promise.all([media.save(file.id, 'wav', new Uint8Array([1, 2])), media.save(file.id, 'wav', new Uint8Array([3, 4]))]);
  assert.equal(new Set(outputs).size, 2);
  assert.ok(outputs.includes(path.join(root, 'my clip-converted (1).wav')));
  assert.ok(outputs.includes(path.join(root, 'my clip-converted (2).wav')));
  assert.equal(await fs.readFile(original, 'utf8'), 'keep original');
  assert.equal(await fs.readFile(path.join(root, 'my clip-converted.wav'), 'utf8'), 'keep previous');
  await assert.rejects(media.save(file.id, '../exe', new Uint8Array([1])));
  await assert.rejects(media.save(file.id, 'mp3', new Uint8Array()));
  await assert.rejects(media.read('unselected'));
});
