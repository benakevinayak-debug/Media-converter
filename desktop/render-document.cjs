const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const htmlPolicy="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; base-uri 'none'; form-action 'none'";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function validateLottie(data){
 if(!data||!Array.isArray(data.layers)||!(data.fr>0)||!(data.op>data.ip)||!(data.w>0)||!(data.h>0))throw Error('Choose a valid Lottie animation JSON.');
 if((data.op-data.ip)/data.fr>20)throw Error('Lottie animations must be 20 seconds or shorter.');
 const check=value=>{if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){
  if(key==='x'&&typeof child==='string')throw Error('Lottie expressions are not supported. Export a baked keyframe animation.');
  if(key==='ef'&&Array.isArray(child)&&child.length)throw Error('Lottie layer effects are not supported.');
  if(key==='p'&&typeof child==='string'&&!child.startsWith('data:'))throw Error('Lottie image assets must be embedded as data URLs.');
  if(key==='fPath'&&typeof child==='string'&&!child.startsWith('data:'))throw Error('External Lottie fonts are not supported.');
  check(child);
 }};check(data);return data;
}
function createDocumentRenderer({BrowserWindow,session}){
 return async({tool,filename,options:o,temporary})=>{
  const source=await fs.readFile(filename,'utf8');if(Buffer.byteLength(source)>5*1048576)throw Error('HTML and Lottie source files must be under 5 MB.');
  const data=tool==='lottie'?validateLottie(JSON.parse(source)):null;
  const isolated=session.fromPartition('asset-render-'+randomUUID());isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:')}));
  const window=new BrowserWindow({show:false,frame:false,backgroundColor:'#ffffff',width:o.width,height:o.height,useContentSize:true,webPreferences:{session:isolated,nodeIntegration:false,contextIsolation:true,sandbox:true,javascript:tool==='lottie',backgroundThrottling:false,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  const animations=[];
  try{
   if(tool==='html'){
    if(['mp4','webm'].includes(o.format)){window.webContents.debugger.attach('1.3');window.webContents.debugger.on('message',(_event,method,params)=>{if(method==='Animation.animationStarted')animations.push(params.animation.id)});await window.webContents.debugger.sendCommand('Animation.enable');await window.webContents.debugger.sendCommand('Animation.setPlaybackRate',{playbackRate:0});}
    await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<meta http-equiv="Content-Security-Policy" content="${htmlPolicy}">${source}`));
    await delay(150);
    if(o.format==='pdf')return {bytes:await window.webContents.printToPDF({printBackground:true,preferCSSPageSize:true})};
    if(o.format==='png')return {bytes:(await window.webContents.capturePage()).toPNG()};
   }else{
    await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html><body style="margin:0;overflow:hidden;background:transparent"><div id="animation" style="width:100vw;height:100vh"></div></body></html>'));
    const library=await fs.readFile(require.resolve('lottie-web/build/player/lottie_light.min.js'),'utf8');
    await window.webContents.executeJavaScript(library);
    await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{window.animation=lottie.loadAnimation({container:document.getElementById('animation'),renderer:'svg',loop:false,autoplay:false,animationData:${JSON.stringify(data)}});animation.addEventListener('DOMLoaded',()=>resolve(true));animation.addEventListener('data_failed',()=>reject(Error('Lottie data could not be rendered')));setTimeout(()=>reject(Error('Lottie rendering timed out')),15000)})`);
   }
   const duration=data?(data.op-data.ip)/data.fr:o.duration;
   const count=Math.ceil(duration*o.fps);if(count>600||count*o.width*o.height>600000000)throw Error('Export is too large. Reduce duration, frame rate or dimensions.');
   const frames=path.join(temporary,'frames');await fs.mkdir(frames);
   for(let i=0;i<count;i++){
    if(data)await window.webContents.executeJavaScript(`animation.goToAndStop(${i/o.fps*data.fr},true)`);
    else if(animations.length)await window.webContents.debugger.sendCommand('Animation.seekAnimations',{animations,currentTime:i/o.fps*1000});
    await delay(5);
    const capture=await window.webContents.capturePage();await fs.writeFile(path.join(frames,`frame-${String(i+1).padStart(6,'0')}.png`),capture.toPNG());
   }
   return {frames};
  }finally{window.destroy();await isolated.clearStorageData();}
 };
}
module.exports={createDocumentRenderer,validateLottie,htmlPolicy};
