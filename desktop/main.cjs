const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { storeDisplayName = 'MediaConvert' } = require('../package.json');
const displayName = process.windowsStore ? storeDisplayName : 'MediaConvert';
const { MediaFiles } = require('./files.cjs');
const media = new MediaFiles();
const { AssetTools, TOOLS } = require('./asset-tools.cjs');
const { createDocumentRenderer } = require('./render-document.cjs');
let assets;
let mainWindow;
const commandPaths = argv => {
  const index = argv.indexOf('--convert');
  return index < 0 ? [] : argv.slice(index + 1);
};
let pendingPaths = commandPaths(process.argv);
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    pendingPaths.push(...commandPaths(argv));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); mainWindow.focus();
      mainWindow.webContents.send('media:selection');
    }
  });
}


protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true
} }]);

function createWindow() {
  const window = mainWindow = new BrowserWindow({
    width: 1360, height: 860, minWidth: 900, minHeight: 640,
    backgroundColor: '#13111d',
    title: displayName + ' — by Vinayak Benake', icon: path.join(__dirname, 'app-icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== 'app://desktop/index.html') event.preventDefault();
  });
  window.on('closed', () => { mainWindow = null; });
  window.loadURL('app://desktop/index.html');
}

app.whenReady().then(() => {
  if (!primaryInstance) return;
  function handle(channel, callback) {
    ipcMain.handle(channel, (event, ...args) => {
      if (event.sender !== mainWindow?.webContents || event.senderFrame.url !== 'app://desktop/index.html') throw new Error('Untrusted request.');
      return callback(...args);
    });
  }
  assets = new AssetTools({render:createDocumentRenderer({BrowserWindow,session})});
  handle('tools:choose', async (tool, folder=false) => {
    if(!TOOLS[tool] || (folder && tool!=='batch'))throw Error('Unknown tool selection.');
    const result=await dialog.showOpenDialog(mainWindow,{title:'Choose assets',properties:folder?['openDirectory']:['openFile','multiSelections'],filters:folder?[]:[{name:'Supported assets',extensions:TOOLS[tool].extensions}]});
    if(result.canceled)return {files:[],warnings:[],canceled:true};
    return assets.collect(tool,result.filePaths);
  });
  handle('tools:run', (tool,ids,options) => assets.run(tool,ids,options,progress=>mainWindow?.webContents.send('tools:progress',progress)));
  handle('tools:reveal', id => {const item=assets.items.get(id);if(item?.output)shell.showItemInFolder(item.output)});
  handle('app:info', () => ({ version: app.getVersion(), displayName, creator: 'Vinayak Benake', support: 'Benakevinayak@gmail.com', store: !!process.windowsStore }));
  handle('media:import', paths => media.collect(paths));
  handle('media:choose', async folder => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: folder ? ['openDirectory'] : ['openFile', 'multiSelections'],
      title: folder ? 'Choose a folder to convert' : 'Choose media files'
    });
    if (result.canceled) return { files: [], warnings: [], canceled: true };
    return media.collect(result.filePaths);
  });
  handle('media:pending', () => { const paths = pendingPaths; pendingPaths = []; return media.collect(paths); });
  handle('media:read', id => media.read(id));
  handle('media:save', (id, ext, bytes) => media.save(id, ext, bytes));
  handle('media:reveal', id => {
    const output = media.item(id).output;
    if (output) shell.showItemInFolder(output);
  });
  protocol.handle('app', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'desktop') return new Response('Not found', { status: 404 });
    const relative = decodeURIComponent(url.pathname).slice(1);
    const vendors = { ffmpeg: '@ffmpeg/ffmpeg', core: '@ffmpeg/core', util: '@ffmpeg/util' };
    let root = __dirname;
    let resource = relative;
    if (relative.startsWith('vendor/')) {
      const [, vendor, ...parts] = relative.split('/');
      if (!vendors[vendor]) return new Response('Not found', { status: 404 });
      root = path.join(__dirname, '../node_modules', vendors[vendor], 'dist/umd');
      resource = parts.join('/');
    } else if (!['index.html', 'renderer.js', 'tools.js', 'styles.css', 'hero.png'].includes(relative)) {
      return new Response('Not found', { status: 404 });
    }
    const file = path.resolve(root, resource);
    if (!file.startsWith(path.resolve(root) + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
