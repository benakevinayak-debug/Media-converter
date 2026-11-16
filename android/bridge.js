(() => {
 const pending = new Map(); let sequence = 0;
 window.__androidResult = (id, value, error) => {
  const request=pending.get(id);if(!request)return;pending.delete(id);
  if(error)request.reject(new Error(error));else {try{request.resolve(JSON.parse(value))}catch(e){request.reject(e)}}
 };
 function choose(folder){return new Promise((resolve,reject)=>{const id=String(++sequence);pending.set(id,{resolve,reject});Native.choose(id,folder)})}
 function sync(result){const response=JSON.parse(result);if(!response.ok)throw new Error(response.error);return response.value}
 window.desktop = {
  info:async()=>JSON.parse(Native.info()),
  pending:async()=>({files:[],warnings:[]}),onSelection:()=>()=>{},
  chooseFiles:()=>choose(false),chooseFolder:()=>choose(true),
  importDrop:async()=>{throw new Error('Use Choose files or Choose a folder on Android.')},
  read:async id=>{const response=await fetch('/media/'+encodeURIComponent(id));if(!response.ok)throw new Error('Could not read selected file. Select it again.');return new Uint8Array(await response.arrayBuffer())},
  save:async(id,ext,bytes)=>{
   const token=sync(Native.beginSave(id,ext));
   try{
    for(let i=0;i<bytes.length;i+=196608){
     const chunk=bytes.subarray(i,i+196608);let binary='';
     for(let j=0;j<chunk.length;j+=16384)binary+=String.fromCharCode(...chunk.subarray(j,j+16384));
     sync(Native.appendSave(token,btoa(binary)));await new Promise(resolve=>setTimeout(resolve,0));
    }
    return sync(Native.finishSave(token));
   }catch(error){Native.abortSave(token);throw error}
  },
  reveal:async id=>sync(Native.reveal(id))
 };
 window.addEventListener('DOMContentLoaded',()=>{
  const convert=document.getElementById('go');const original=convert.onclick;
  convert.onclick=async()=>{Native.setConverting(true);try{return await original()}finally{Native.setConverting(false)}};
 });
})();
