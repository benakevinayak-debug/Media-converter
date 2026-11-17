const $=id=>document.getElementById(id);
const CORE_BASE='app://desktop/vendor/core';
const VID=['mp4','mov','mkv','webm','avi'],AUD=['mp3','wav','flac','aac','m4a','ogg','opus'];
const FORMATS=[...VID,'gif',...AUD];
let fmt='mp4',qual='auto',files=[],ffmpeg=null,busy=false,logBuf=[],filter='all',query='',stopAfterFile=false;
const preview=window.DESIGN_PREVIEW===true;
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;
const fmtSize=bytes=>bytes>=1073741824?(bytes/1073741824).toFixed(2)+' GB':bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':bytes?Math.max(1,Math.round(bytes/1024))+' KB':'0 KB';
const formatLabel=ext=>ext.toUpperCase()+(AUD.includes(ext)?' (Audio)':ext==='gif'?' (Animation)':' (Video)');
const appendOptions=(select,value,full=false)=>{
 select.replaceChildren();
 for(const ext of FORMATS){const option=document.createElement('option');option.value=ext;option.textContent=full?formatLabel(ext):ext.toUpperCase();select.appendChild(option)}
 select.value=value;
};
function selectedFiles(){return files.filter(f=>f.selected&&!f.done)}
function counts(){return {all:files.length,converting:files.filter(f=>f.phase==='converting').length,completed:files.filter(f=>f.done).length,queued:files.filter(f=>f.phase==='queued').length}}
function updateTotals(){
 const c=counts(),selected=selectedFiles().length;
 $('queue-count').textContent='('+ (document.getElementById('history').classList.contains('active')?c.completed:c.all) +')';
 $('nav-count').textContent=String(c.all);
 for(const key of Object.keys(c))$('count-'+key).textContent='('+c[key]+')';
 $('workspace-size').textContent=c.all?`${c.all} ${c.all===1?'file':'files'} · ${fmtSize(files.reduce((sum,f)=>sum+f.file.size,0))}`:'No files added';
 $('session-detail').textContent=c.all?`${c.completed} of ${c.all} completed`:'Your files stay on your device';
 const progress=c.all?c.completed/c.all*100:0;$('session-progress').style.width=progress+'%';$('session-progress').parentElement.setAttribute('aria-valuenow',String(Math.round(progress)));
 $('queue-summary').textContent=`${c.all} ${c.all===1?'file':'files'} · ${selected} selected`;
 $('go').disabled=busy||!selected||preview;
 $('go-label').textContent=preview?'Windows app required':busy?'Converting…':selected?`Convert ${selected} ${selected===1?'File':'Files'}`:c.all?'Select files to convert':'Add files to begin';
 $('clear').disabled=busy||!files.length;$('stop').hidden=!busy;$('stop').disabled=stopAfterFile;
 const pending=files.filter(f=>!f.done);$('select-all').disabled=busy||!pending.length;$('select-all').checked=!!pending.length&&pending.every(f=>f.selected);$('select-all').indeterminate=pending.some(f=>f.selected)&&!pending.every(f=>f.selected);
 $('format').disabled=busy;$('fast').disabled=busy;$('open-folder').disabled=busy;
 document.querySelectorAll('#quals button,[data-category],[data-preset]').forEach(b=>b.disabled=busy);
}
function visibleFiles(){return files.filter(f=>{
 const phase=filter==='all'||(filter==='completed'?f.done:f.phase===filter);
 const text=(f.file.name+' '+(f.ext||fmt)+' '+f.file.folder).toLowerCase();
 return phase&&(!query||text.includes(query));
})}
function statusView(f){
 if(!f.el)return;
 const box=f.el.querySelector('.file-status');box.replaceChildren();
 if(f.phase==='converting'){
  box.innerHTML='<div class="progress-line"><div class="bar" role="progressbar" aria-label="Conversion progress" aria-valuemin="0" aria-valuemax="100"><i></i></div><span class="percent"></span></div><div class="status-caption"></div>';
  box.querySelector('.status-caption').textContent=f.status||'Converting…';setBar(f,f.p||0);
 }else{
  const line=document.createElement('div');line.className='status-line'+(f.done?' completed':f.phase==='failed'?' failed':'');
  line.innerHTML=icon(f.done?'check-icon':f.phase==='failed'?'info':'history-icon')+'<span></span>';
  line.querySelector('span').textContent=f.done?'Completed':f.phase==='failed'?'Failed':'Queued';line.title=f.status||'Queued';box.appendChild(line);
 }
}
function render(){
 files.forEach(f=>f.el=null);const visible=visibleFiles();$('list').replaceChildren();$('list').hidden=!visible.length;$('empty').hidden=!!visible.length;
 $('empty').querySelector('strong').textContent=!files.length?'Your queue is ready when you are':query?'No matching files':filter==='completed'?'No completed files in this queue':filter==='converting'?'No files converting right now':'No queued files';
 $('empty').querySelector('p').textContent=!files.length?'Add files or a folder to start converting.':query?'Try another filename or output format.':'Use All to see the rest of your queue.';
 for(const f of visible){
  const row=document.createElement('div');row.className='file';row.dataset.id=f.file.id;
  row.innerHTML='<input class="file-check" type="checkbox"><div class="thumbnail"></div><div class="file-info"><div class="name"></div><div class="meta"></div></div><select class="row-format"></select><div class="file-status"></div><button class="file-action"></button><button class="remove-file" aria-label="Remove from queue">×</button>';
  const check=row.querySelector('.file-check');check.checked=!!f.selected;check.disabled=busy||f.done;check.setAttribute('aria-label','Select '+f.file.name);check.onchange=()=>{f.selected=check.checked;updateTotals()};
  const type=f.file.type.startsWith('audio')?'audio':/\.gif$/i.test(f.file.name)?'gif':'video';
  const thumbnail=row.querySelector('.thumbnail');thumbnail.classList.add(type);thumbnail.innerHTML=icon(type==='audio'?'audio-icon':type==='gif'?'image-icon':'play');
  row.querySelector('.name').textContent=f.file.name;row.querySelector('.name').title=f.file.name;
  row.querySelector('.meta').textContent=(f.file.name.split('.').pop()||'FILE').toUpperCase()+' · '+fmtSize(f.file.size);row.querySelector('.meta').title=f.output||f.file.folder;
  const format=row.querySelector('.row-format');appendOptions(format,f.ext||fmt);format.disabled=busy||f.done;format.setAttribute('aria-label','Output format for '+f.file.name);format.onchange=()=>{f.ext=format.value};
  const action=row.querySelector('.file-action');action.innerHTML=icon('folder-icon');action.title=f.done?'Show converted file in folder':'Output will save beside original';action.setAttribute('aria-label',action.title);action.disabled=!f.done;action.onclick=()=>reveal(f);
  const remove=row.querySelector('.remove-file');remove.disabled=busy;remove.title='Remove from queue';remove.setAttribute('aria-label','Remove '+f.file.name+' from queue');remove.onclick=()=>{if(!busy){files=files.filter(item=>item!==f);render()}};
  f.el=row;$('list').appendChild(row);statusView(f);
 }
 updateTotals();
}
function setSt(f,text,cls=''){f.status=text;f.cls=cls;statusView(f)}
function setBar(f,value){f.p=Math.max(0,Math.min(1,Number.isFinite(value)?value:0));if(!f.el)return;const bar=f.el.querySelector('.bar');if(bar){bar.querySelector('i').style.width=f.p*100+'%';bar.setAttribute('aria-valuenow',String(Math.round(f.p*100)));f.el.querySelector('.percent').textContent=Math.round(f.p*100)+'%'}}
function reveal(f){window.desktop.reveal(f.file.id).catch(error=>{$('msg').textContent=error.message})}
function setFilter(value){filter=value;document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});render()}
function activateNav(id){document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.id===id));$('queue-title').firstChild.textContent=id==='history'?'History ':'Queue '}
function setFormat(value){
 if(busy||!FORMATS.includes(value))return;fmt=value;$('format').value=value;files.filter(f=>!f.done).forEach(f=>f.ext=value);
 const category=AUD.includes(value)?'audio':value==='gif'?'gif':'video';
 document.querySelectorAll('[data-category]').forEach(b=>{const active=b.dataset.category===category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 $('format-icon').querySelector('use').setAttribute('href','#'+(category==='audio'?'audio-icon':category==='gif'?'image-icon':'play'));updateHints();render();
}
function setQuality(value){if(busy)return;qual=value;document.querySelectorAll('#quals button').forEach(b=>{const active=b.dataset.q===value;b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active))});updateHints()}
function updateHints(){
 const lossless=['wav','flac'].includes(fmt);
 $('quality-hint').textContent=lossless?'WAV and FLAC use lossless presets; quality buttons do not change them.':fmt==='gif'?'GIF uses a fixed 12 fps, 480 px preset and removes audio.':qual==='auto'?'Auto uses Balanced quality. Compatible streams retain their original quality when Smart stream copy is enabled.':({low:'Small uses more compression for less storage.',medium:'Balanced keeps size and quality in proportion.',high:'High preserves more detail with larger outputs.'})[qual];
}
function addSelection(result,quietEmpty=false){
 if(result.canceled||(quietEmpty&&!result.files.length&&!result.warnings.length))return;
 for(const file of result.files)if(!files.some(f=>f.file.id===file.id))files.push({file,selected:true,phase:'queued',ext:fmt,p:0});
 query='';$('search').value='';activateNav('nav-convert');setFilter('all');
 $('msg').textContent=result.warnings.length?'Some items could not be read: '+result.warnings.join('; '):!result.files.length?'No supported media files found.':preview?'Design preview only. Convert files in the Windows app.':`Added ${result.files.length} media file(s). Outputs save beside originals.`;
}
async function importSelection(action,quietEmpty=false){try{addSelection(await action(),quietEmpty)}catch(error){$('msg').textContent='Could not add files: '+error.message}}
appendOptions($('format'),fmt,true);
$('format').onchange=()=>setFormat($('format').value);
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>setFormat(b.dataset.category==='audio'?'mp3':b.dataset.category==='gif'?'gif':'mp4'));
$('quals').onclick=event=>{const b=event.target.closest('[data-q]');if(b)setQuality(b.dataset.q)};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{activateNav('nav-convert');setFilter(b.dataset.filter)});
$('search').oninput=()=>{query=$('search').value.trim().toLowerCase();render()};
$('select-all').onchange=()=>{if(!busy){files.filter(f=>!f.done).forEach(f=>f.selected=$('select-all').checked);render()}};
$('add-files').onclick=()=>importSelection(()=>window.desktop.chooseFiles());
$('folder').onclick=()=>importSelection(()=>window.desktop.chooseFolder());
['dragover','dragenter'].forEach(type=>document.addEventListener(type,event=>{event.preventDefault();$('drop').classList.add('over')}));
['dragleave','drop'].forEach(type=>document.addEventListener(type,event=>{event.preventDefault();$('drop').classList.remove('over')}));
document.addEventListener('drop',event=>{const incoming=Array.from(event.dataTransfer.files);importSelection(()=>window.desktop.importDrop(incoming))});
$('clear').onclick=()=>{if(!busy){files=[];render();$('msg').textContent='Queue cleared. Saved files remain in their original folders.'}};
$('stop').onclick=()=>{stopAfterFile=true;$('stop').disabled=true;$('msg').textContent='The current file will finish; remaining files will stay queued.'};
window.desktop.onSelection(()=>importSelection(()=>window.desktop.pending(),true));
importSelection(()=>window.desktop.pending(),true);
const Q={low:{crf:30,abr:"96k",vp9:40},medium:{crf:25,abr:"160k",vp9:33},high:{crf:20,abr:"256k",vp9:28}};
const MAPS=["-map","0:v:0?","-map","0:a:0?","-sn","-dn"];          // keep only first video + audio (drops iPhone data tracks)
const EVEN="scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p";    // even size + 8-bit 4:2:0 for compatibility
const x264=q=>["-c:v","libx264","-preset","ultrafast","-crf",Q[q].crf,"-vf",EVEN];
function args(ext,q){const p=Q[q];switch(ext){
 case"mp4":case"mov":case"mkv":return[...MAPS,...x264(q),"-c:a","aac","-b:a",p.abr,...(ext==="mp4"?["-movflags","+faststart"]:[])];
 case"webm":return[...MAPS,"-c:v","libvpx","-crf",p.vp9,"-b:v","1M","-deadline","realtime","-cpu-used","8","-vf",EVEN,"-c:a","libvorbis"];
 case"avi":return[...MAPS,"-c:v","mpeg4","-qscale:v",q==="high"?"2":q==="medium"?"5":"9","-vf",EVEN,"-c:a","libmp3lame","-b:a",p.abr];
 case"gif":return["-map","0:v:0","-vf","fps=12,scale=480:-1:flags=lanczos","-an","-loop","0"];
 case"mp3":return["-map","0:a:0","-vn","-c:a","libmp3lame","-b:a",p.abr];
 case"wav":return["-map","0:a:0","-vn","-c:a","pcm_s16le"];
 case"flac":return["-map","0:a:0","-vn","-c:a","flac"];
 case"aac":case"m4a":return["-map","0:a:0","-vn","-c:a","aac","-b:a",p.abr];
 case"ogg":return["-map","0:a:0","-vn","-c:a","libvorbis","-b:a",p.abr];
 case"opus":return["-map","0:a:0","-vn","-c:a","libopus","-b:a",p.abr];}return[]}

async function loadEngine(){
 if(ffmpeg)return ffmpeg;
 const{FFmpeg}=FFmpegWASM;
 async function blobURL(url,mime,show){const r=await fetch(url);if(!r.ok)throw new Error("download failed ("+r.status+")");
  const total=+r.headers.get("content-length")||32*1048576,rd=r.body.getReader(),ch=[];let got=0;
  for(;;){const{done,value}=await rd.read();if(done)break;ch.push(value);got+=value.length;
   if(show)$("msg").textContent="Loading bundled engine… "+Math.min(99,Math.round(got/total*100))+"%"}
  return URL.createObjectURL(new Blob(ch,{type:mime}))}
 $("msg").textContent="Loading bundled engine…";

 const wasmURL=await blobURL(`${CORE_BASE}/ffmpeg-core.wasm`,"application/wasm",true);
 let last;
 for(const dir of["umd"]){try{
  $("msg").textContent="Starting engine…";
  const coreURL=await blobURL(`app://desktop/vendor/core/ffmpeg-core.js`,"text/javascript");
  const inst=new FFmpeg();
  inst.on("log",({message})=>{logBuf.push(message);if(logBuf.length>400)logBuf.shift();const l=$("log");l.textContent=logBuf.join("\n");l.scrollTop=l.scrollHeight});
  await Promise.race([inst.load({coreURL,wasmURL}),new Promise((_,j)=>setTimeout(()=>j(new Error("engine start timed out")),45000))]);
  ffmpeg=inst;$("msg").textContent="Engine ready.";return ffmpeg}catch(e){last=e}}
 throw last}

// ---- conversion
async function probe(inName){logBuf.length=0;await ffmpeg.exec(["-hide_banner","-i",inName]);
 const t=logBuf.join("\n");return{v:(t.match(/Video: (\w+)/)||[])[1],a:(t.match(/Audio: (\w+)/)||[])[1]}}
const tail=()=>{const l=logBuf.filter(x=>x.trim()).slice(-2).join(" | ");return l?l.slice(0,160):"unsupported or corrupt file"};

async function run(inName,outName,a){logBuf.length=0;let code;
 try{code=await ffmpeg.exec(["-y","-i",inName,...a,outName].map(String))}catch(e){code=1}
 if(code!==0)return null;
 try{const d=await ffmpeg.readFile(outName);return d.length>2048?d:null}catch(e){return null}}

function showError(){ $('diagnostics').hidden=false;$('diagnostics').open=true; }
$('go').onclick=async()=>{
 if(busy||preview)return;const batch=selectedFiles();if(!batch.length)return;
 busy=true;stopAfterFile=false;const q=qual==='auto'?'medium':qual,fast=$('fast').checked,open=$('open-folder').checked;let succeeded=0,failed=0,lastSaved=null;
 // Snapshot per-file choices so new imports wait for the next batch.
 const jobs=batch.map(f=>({f,ext:f.ext||fmt}));render();
 try{await loadEngine()}catch(error){$('msg').textContent='Could not start the engine: '+error.message;showError();busy=false;render();return}
 for(let index=0;index<jobs.length;index++){
  const {f,ext}=jobs[index];const inName='input_'+index+'.'+(f.file.name.split('.').pop()||'bin'),outName='output_'+index+'.'+ext;
  const progress=({progress})=>{if(progress>=0&&progress<=1)setBar(f,progress)};
  f.phase='converting';f.p=0;f.status='Preparing file…';render();
  try{
   ffmpeg.on('progress',progress);await ffmpeg.writeFile(inName,await window.desktop.read(f.file.id));let data=null;
   if(fast&&['mp4','mov','mkv'].includes(ext)){
    setSt(f,'Analyzing…');const info=await probe(inName);const copy=info.v==='h264',audioCopy=!info.a||['aac','mp3'].includes(info.a);
    const options=[...MAPS,...(copy?['-c:v','copy']:x264(q)),...(info.a?(audioCopy?['-c:a','copy']:['-c:a','aac','-b:a',Q[q].abr]):[]),...(ext==='mp4'?['-movflags','+faststart']:[])];
    setSt(f,copy?'Copying compatible streams…':'Encoding video…');data=await run(inName,outName,options);
   }
   if(!data){setSt(f,'Converting…');setBar(f,0);data=await run(inName,outName,args(ext,q))}
   if(!data)throw new Error(tail());
   setSt(f,'Saving beside original…');f.output=await window.desktop.save(f.file.id,ext,data);f.done=true;f.phase='completed';f.status='Saved: '+f.output;f.p=1;succeeded++;lastSaved=f;
  }catch(error){f.phase='failed';f.status=error.message;failed++;showError()}
  finally{ffmpeg.off('progress',progress);await ffmpeg.deleteFile(inName).catch(()=>{});await ffmpeg.deleteFile(outName).catch(()=>{});render()}
  if(stopAfterFile)break;
 }
 busy=false;render();
 $('msg').textContent=`${stopAfterFile?'Stopped after current file.':'Finished.'} ${succeeded} saved, ${failed} failed${selectedFiles().length?', '+selectedFiles().length+' still pending':''}. Originals are kept.`;
 if(open&&lastSaved)reveal(lastSaved);
};
function showModal(id){$(id).showModal()}
$('about').onclick=$('footer-about').onclick=()=>showModal('about-modal');
$('privacy').onclick=()=>showModal('privacy-modal');
$('tools').onclick=()=>showModal('tools-modal');
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('nav-convert').onclick=()=>{activateNav('nav-convert');setFilter('all');$('add-files').focus()};
$('nav-files').onclick=()=>{activateNav('nav-files');setFilter('all');$('queue-title').scrollIntoView({block:'nearest',behavior:'smooth'})};
$('history').onclick=()=>{activateNav('history');query='';$('search').value='';setFilter('completed');$('queue-title').scrollIntoView({block:'nearest',behavior:'smooth'});$('msg').textContent='History shows completed files in the current queue. Saved files remain on disk after the queue is cleared.'};
$('settings').onclick=()=>{activateNav('settings');$('settings-title').focus();$('settings-title').scrollIntoView({block:'nearest',behavior:'smooth'})};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{setFormat(b.dataset.preset);setQuality(b.dataset.preset==='mp4'?'low':'medium');$('tools-modal').close();$('msg').textContent='Preset applied to queued files. Add media or click Convert.'});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();$('search').focus()}});
function setTheme(value){document.documentElement.dataset.theme=value;$('theme').setAttribute('aria-label',`Switch to ${value==='dark'?'light':'dark'} theme`);try{localStorage.setItem('mediaconvert-1.3-theme',value)}catch{}}
let initialTheme='dark';try{initialTheme=localStorage.getItem('mediaconvert-1.3-theme')||initialTheme}catch{}
setTheme(initialTheme);$('theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
if(window.desktop.info)window.desktop.info().then(info=>{if(info.displayName){document.querySelector('.brand strong').textContent=info.displayName;$('about-title').textContent=info.displayName;document.title=info.displayName+' — by Vinayak Benake';}$('version-label').textContent='Version '+info.version;$('about-version').textContent='Version '+info.version}).catch(()=>{});
render();updateHints();
