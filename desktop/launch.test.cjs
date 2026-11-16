const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

test('Explorer launch queues paths with spaces, forwards later launches, and restricts IPC to the app window', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'mediaconvert-launch-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const first = path.join(folder, 'first clip.mp4'), second = path.join(folder, 'next clip.mp3');
  await fs.writeFile(first, 'video'); await fs.writeFile(second, 'audio');
  const app = new EventEmitter();
  app.requestSingleInstanceLock = () => true;
  app.whenReady = () => Promise.resolve();
  app.quit = () => {};
  const handlers = new Map(), sent = [];
  let window;
  class Window extends EventEmitter {
    constructor() {
      super(); window = this;
      this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.send = channel => sent.push(channel);
    }
    loadURL(url) { this.url = url; }
    isMinimized() { return false; }
    show() {} focus() {}
  }
  const electron = { app, BrowserWindow: Window, protocol: { registerSchemesAsPrivileged() {}, handle() {} }, net: {}, ipcMain: { handle: (key, fn) => handlers.set(key, fn) }, dialog: {}, shell: {} };
  vm.runInNewContext(await fs.readFile(path.join(__dirname, 'main.cjs'), 'utf8'), {
    require: name => name === 'electron' ? electron : name === './files.cjs' ? require('./files.cjs') : require(name),
    process: { argv: ['MediaConvert.exe', '--convert', first], platform: 'win32' }, __dirname, Response, URL
  });
  await new Promise(resolve => setImmediate(resolve));
  const sender = { sender: window.webContents, senderFrame: { url: window.url } };
  const pending = handlers.get('media:pending');
  assert.equal((await pending(sender)).files[0].name, 'first clip.mp4');
  assert.equal((await pending(sender)).files.length, 0);
  app.emit('second-instance', {}, ['MediaConvert.exe', '--convert', second]);
  assert.deepEqual(sent, ['media:selection']);
  assert.equal((await pending(sender)).files[0].name, 'next clip.mp3');
  assert.throws(() => pending({ sender: {}, senderFrame: { url: window.url } }), /Untrusted/);
  assert.throws(() => pending({ ...sender, senderFrame: { url: 'https://example.com' } }), /Untrusted/);
});
