const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function bridge(fail=false){
 const chunks=[];let aborted=false,finished=false;
 const Native={
  beginSave:()=>JSON.stringify({ok:true,value:'write-token'}),
  appendSave:(_token,data)=>{if(fail)return JSON.stringify({ok:false,error:'Folder is read-only'});chunks.push(Buffer.from(data,'base64'));return JSON.stringify({ok:true,value:true})},
  finishSave:()=>{finished=true;return JSON.stringify({ok:true,value:'Chosen folder/output.mp3'})},
  abortSave:()=>{aborted=true},
  choose:(id,folder)=>queueMicrotask(()=>window.__androidResult(id,JSON.stringify({files:[],warnings:[],canceled:true}),null))
 };
 const window={addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'bridge.js'),'utf8'),{window,Native,Uint8Array,setTimeout,btoa});
 return {api:window.desktop,chunks,get aborted(){return aborted},get finished(){return finished}};
}
test('Android save bridge transfers multiple binary chunks without changing their contents',async()=>{
 const native=bridge();const input=Uint8Array.from({length:700000},(_,i)=>i%256);
 assert.equal(await native.api.save('input-id','mp3',input),'Chosen folder/output.mp3');
 assert.deepEqual(Buffer.concat(native.chunks),Buffer.from(input));assert.equal(native.finished,true);assert.equal(native.aborted,false);
});
test('Android save bridge aborts partial output when native storage rejects a write',async()=>{
 const native=bridge(true);await assert.rejects(native.api.save('input-id','mp3',new Uint8Array([1,2,3])),/read-only/);assert.equal(native.aborted,true);assert.equal(native.finished,false);
});
test('Android picker cancellation resolves the pending request',async()=>{
 const native=bridge();assert.equal((await native.api.chooseFiles()).canceled,true);
});
