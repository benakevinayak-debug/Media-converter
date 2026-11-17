const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  chooseAssets: (tool,folder=false) => ipcRenderer.invoke('tools:choose',tool,folder),
  runTool: (tool,ids,options) => ipcRenderer.invoke('tools:run',tool,ids,options),
  revealAsset: id => ipcRenderer.invoke('tools:reveal',id),
  onToolProgress: callback => {const listener=(_event,value)=>callback(value);ipcRenderer.on('tools:progress',listener);return ()=>ipcRenderer.removeListener('tools:progress',listener)},
  compressionChoose: folder => ipcRenderer.invoke('compression:choose',folder),
  compressionDrop: files => ipcRenderer.invoke('compression:drop',Array.from(files,file=>webUtils.getPathForFile(file)).filter(Boolean)),
  compressionRun: (ids,mode)=>ipcRenderer.invoke('compression:run',ids,mode),
  compressionClear: ()=>ipcRenderer.invoke('compression:clear'),
  compressionSave: id=>ipcRenderer.invoke('compression:save',id),
  compressionZip: ids=>ipcRenderer.invoke('compression:zip',ids),
  onCompressionProgress: callback=>{const listener=(_event,item)=>callback(item);ipcRenderer.on('compression:progress',listener);return ()=>ipcRenderer.removeListener('compression:progress',listener)},
  info: () => ipcRenderer.invoke('app:info'),
  importDrop: files => ipcRenderer.invoke('media:import', Array.from(files, file => webUtils.getPathForFile(file)).filter(Boolean)),
  chooseFiles: () => ipcRenderer.invoke('media:choose', false),
  chooseFolder: () => ipcRenderer.invoke('media:choose', true),
  pending: () => ipcRenderer.invoke('media:pending'),
  read: id => ipcRenderer.invoke('media:read', id),
  save: (id, ext, bytes) => ipcRenderer.invoke('media:save', id, ext, bytes),
  reveal: id => ipcRenderer.invoke('media:reveal', id),
  onSelection: callback => {
    const listener = () => callback();
    ipcRenderer.on('media:selection', listener);
    return () => ipcRenderer.removeListener('media:selection', listener);
  }
});
