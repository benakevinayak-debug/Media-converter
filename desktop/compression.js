(()=>{
const items=new Map();let mode='smart',running=false,exporting=false,search='';
const dom=id=>document.getElementById(id),size=value=>value===undefined?'—':value<1024?value+' B':value<1048576?(value/1024).toFixed(1)+' KB':value<1073741824?(value/1048576).toFixed(2)+' MB':(value/1073741824).toFixed(2)+' GB';
const announce=message=>dom('image-message').textContent=message;
function update(){
 const done=[...items.values()].filter(i=>i.status==='done'),original=done.reduce((sum,i)=>sum+i.originalSize,0),compressed=done.reduce((sum,i)=>sum+i.compressedSize,0),saved=original-compressed,failed=[...items.values()].filter(i=>i.status==='failed').length,pending=[...items.values()].filter(i=>['queued','failed'].includes(i.status));
 dom('image-original-total').textContent=size(original);dom('image-compressed-total').textContent=size(compressed);dom('image-savings-total').textContent=size(saved);dom('image-savings-percent').textContent=original?(saved/original*100).toFixed(1)+'%':'0%';
 dom('image-summary').textContent=`${done.length} of ${items.size} complete${failed?' · '+failed+' failed':''}${done.length?' · '+size(saved)+' saved ('+(original?saved/original*100:0).toFixed(1)+'%)':''}`;
 dom('image-save-all').disabled=running||exporting||!done.length||preview;dom('image-save-all').textContent='Save All as ZIP'+(done.length?' ('+done.length+')':'');
 dom('image-start').disabled=running||!pending.length||preview;dom('image-start').textContent=preview?'Windows app required':running?'Compressing…':pending.some(i=>i.status==='failed')?'Compress / retry':'Compress images';
 for(const id of ['image-add','image-folder','image-auto'])dom(id).disabled=running;dom('image-clear').disabled=running||exporting;
 document.querySelectorAll('[data-compression-mode]').forEach(b=>{b.disabled=running;b.classList.toggle('on',b.dataset.compressionMode===mode);b.setAttribute('aria-pressed',String(b.dataset.compressionMode===mode))});
 dom('image-count').textContent=String(items.size);dom('image-empty').hidden=items.size>0;dom('image-results-table').hidden=items.size===0;dom('image-count-badge').textContent=items.size||'';
 dom('image-mode-note').textContent=mode==='smart'?'Smart balances quality and size for JPEG, WebP and supported still AVIF. PNG/APNG, JPEG XL and complex AVIF use safe lossless optimization. Applies to pending images.':'Lossless preserves decoded pixels. JPEG uses entropy optimization; PNG/APNG recompress pixel streams. WebP, JPEG XL and complex AVIF optimize their containers without re-encoding image streams.';
}
function render(){
 const list=dom('image-results');list.replaceChildren();
 for(const item of items.values()){
  if(search&&!item.name.toLowerCase().includes(search))continue;
  const row=document.createElement('div');row.className='image-result '+item.status;row.dataset.id=item.id;row.setAttribute('role','listitem');
  const thumb=document.createElement('div');thumb.className='image-thumb';if(item.thumbnail){const image=document.createElement('img');image.src=item.thumbnail;image.alt='';thumb.appendChild(image)}else thumb.innerHTML=icon('image-icon');
  const info=document.createElement('div');info.className='image-file-info';const name=document.createElement('strong');name.textContent=item.name;name.title=item.name;const detail=document.createElement('small');detail.textContent=item.error||item.method||(item.status==='queued'?'Ready to compress':item.stage);detail.title=item.error||item.method||item.folder;info.append(name,detail);
  const state=document.createElement('div');state.className='image-state';const caption=document.createElement('span');caption.textContent=item.status==='done'?(item.noSavings?'No size savings':'Compressed'):item.status==='failed'?'Failed':item.status==='queued'?'Queued':item.stage;
  const track=document.createElement('div');track.className='image-progress';track.setAttribute('role','progressbar');track.setAttribute('aria-label','Compression progress for '+item.name);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(item.progress||0));const bar=document.createElement('i');bar.style.width=(item.progress||0)+'%';track.appendChild(bar);state.append(caption,track);
  const before=document.createElement('span');before.className='image-before image-size';before.textContent=size(item.originalSize);before.setAttribute('aria-label','Original size '+before.textContent);
  const after=document.createElement('span');after.className='image-after image-size';after.textContent=size(item.compressedSize);after.setAttribute('aria-label','Compressed size '+after.textContent);
  const savings=document.createElement('span');savings.className='image-saved';savings.textContent=item.status==='done'?(item.originalSize?(item.saved/item.originalSize*100).toFixed(1):'0')+'%':'—';
  const save=document.createElement('button');save.className='image-save secondary';save.textContent='Save';save.disabled=item.status!=='done'||preview;save.setAttribute('aria-label','Save '+item.name);save.onclick=async()=>{save.disabled=true;try{const result=await window.desktop.compressionSave(item.id);if(!result.canceled)announce('Saved '+result.path)}catch(e){announce('Could not save '+item.name+': '+e.message)}finally{save.disabled=false}};
  row.append(thumb,info,state,before,after,savings,save);list.appendChild(row);
 }
 update();
}
function absorb(item){items.set(item.id,{...items.get(item.id),...item});render()}
async function add(action){try{const result=await action();if(result.canceled)return;for(const item of result.files)items.set(item.id,item);render();announce(result.warnings.length?result.warnings.join('; '):`Added ${result.files.length} image(s). Originals are protected.`);if(result.files.length&&dom('image-auto').checked&&!preview)await start();}catch(e){announce(e.message)}}
async function start(){if(running||preview)return;if(busy||window.assetToolBusy){announce('Wait for the current conversion or tool to finish.');return;}const pending=[...items.values()].filter(i=>['queued','failed'].includes(i.status));if(!pending.length)return;running=true;window.imageCompressionBusy=true;update();updateTotals();announce('Compressing locally. Each result is checked before it can be saved.');try{const results=await window.desktop.compressionRun(pending.map(i=>i.id),mode);for(const item of results)items.set(item.id,item);announce(`Batch finished. ${results.filter(i=>i.status==='done').length} ready to save, ${results.filter(i=>i.status==='failed').length} failed. Source files are unchanged.`);}catch(e){announce(e.message)}finally{running=false;window.imageCompressionBusy=false;render();updateTotals()}}
dom('image-add').onclick=()=>add(()=>window.desktop.compressionChoose(false));dom('image-folder').onclick=()=>add(()=>window.desktop.compressionChoose(true));dom('image-start').onclick=start;
dom('image-clear').onclick=async()=>{if(running)return;try{await window.desktop.compressionClear();items.clear();render();announce('Batch cleared. Source files and exported results remain unchanged.')}catch(e){announce(e.message)}};
dom('image-save-all').onclick=async()=>{if(exporting)return;exporting=true;update();const ids=[...items.values()].filter(i=>i.status==='done').map(i=>i.id);try{dom('image-save-all').disabled=true;const result=await window.desktop.compressionZip(ids);if(!result.canceled)announce('ZIP saved: '+result.path)}catch(e){announce('Could not save ZIP: '+e.message)}finally{exporting=false;update()}};
document.querySelectorAll('[data-compression-mode]').forEach(b=>b.onclick=()=>{if(!running){mode=b.dataset.compressionMode;update()}});
window.importCompressionDrop=files=>{if(running){announce('Wait for the current batch before adding images.');return;}return add(()=>window.desktop.compressionDrop(files));};
window.searchCompressedImages=value=>{search=value.trim().toLowerCase();render()};
window.desktop.onCompressionProgress?.(item=>absorb(item));
window.refreshCompression=update;
render();
})();
