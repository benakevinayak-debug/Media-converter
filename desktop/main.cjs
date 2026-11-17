const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { storeDisplayName = 'MediaConvert' } = require('../package.json');
const displayName = storeDisplayName;
const { MediaFiles } = require('./files.cjs');
const media = new MediaFiles();
const { AssetTools, TOOLS } = require('./asset-tools.cjs');
const { createDocumentRenderer } = require('./render-document.cjs');
let assets;
const { ImageCompression, EXTENSIONS } = require('./compression.cjs');
let compression;
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
  return window;
}

app.whenReady().then(async () => {
  if (!primaryInstance) return;
  function handle(channel, callback) {
    ipcMain.handle(channel, (event, ...args) => {
      if (event.sender !== mainWindow?.webContents || event.senderFrame.url !== 'app://desktop/index.html') throw new Error('Untrusted request.');
      return callback(...args);
    });
  }
  assets = new AssetTools({render:createDocumentRenderer({BrowserWindow,session})});
  compression = new ImageCompression({progress:item=>mainWindow?.webContents.send('compression:progress',item)});
  handle('compression:choose', async folder => {
    const result=await dialog.showOpenDialog(mainWindow,{title:'Add images for compression',properties:folder?['openDirectory']:['openFile','multiSelections'],filters:folder?[]:[{name:'Supported images',extensions:EXTENSIONS}]});
    if(result.canceled)return {files:[],warnings:[],canceled:true};return compression.collect(result.filePaths);
  });
  handle('compression:drop', paths=>compression.collect(paths));
  handle('compression:run', (ids,mode)=>compression.run(ids,mode));
  handle('compression:clear', ()=>compression.clear());
  handle('compression:save', async id=>{
    const item=compression.ready(id),result=await dialog.showSaveDialog(mainWindow,{title:'Save compressed image',defaultPath:await compression.suggested(id),filters:[{name:'Original image format',extensions:[require('node:path').extname(item.name).slice(1)]}]});
    if(result.canceled)return {canceled:true};return {path:await compression.save(id,result.filePath)};
  });
  handle('compression:zip', async ids=>{
    const result=await dialog.showSaveDialog(mainWindow,{title:'Save compressed images as ZIP',defaultPath:'QuickConvert-compressed-images.zip',filters:[{name:'ZIP archive',extensions:['zip']}]});
    if(result.canceled)return {canceled:true};return {path:await compression.zip(ids,result.filePath)};
  });
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
    } else if (!['index.html', 'renderer.js', 'tools.js', 'compression.js', 'styles.css', 'hero.png'].includes(relative)) {
      return new Response('Not found', { status: 404 });
    }
    const file = path.resolve(root, resource);
    if (!file.startsWith(path.resolve(root) + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  const window=createWindow();
  if(process.argv.includes('--verify-image-compression')&&process.env.QUICKCONVERT_COMPRESSION_REPORT){
    try{
      await new Promise(resolve=>window.webContents.once('did-finish-load',resolve));
      await require('./compression-checks.cjs').verifyPackagedCompression({compression,window,reportPath:process.env.QUICKCONVERT_COMPRESSION_REPORT,app});
      await compression.dispose();app.exit(0);
    }catch(error){await require('node:fs/promises').writeFile(process.env.QUICKCONVERT_COMPRESSION_REPORT,JSON.stringify({error:error.stack}));app.exit(1);}
    return;
  }
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

let compressionCleaned=false;
app.on('before-quit',event=>{if(compression&&!compressionCleaned){event.preventDefault();compression.dispose().finally(()=>{compressionCleaned=true;app.quit()})}});
