const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
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
