
const $=id=>document.getElementById(id);
const CORE_BASE="app://desktop/vendor/core";
const VID=["mp4","mov","mkv","webm","avi","gif"],AUD=["mp3","wav","flac","aac","m4a","ogg","opus"];
let fmt="mp4",qual="high",files=[],ffmpeg=null,busy=false,logBuf=[];

// ---- format chips
$("fmts").innerHTML=[...VID.map(e=>[e,"v"]),...AUD.map(e=>[e,"a"])].map(([e,k])=>`<button class="chip${e===fmt?" on":""}" data-f="${e}" aria-pressed="${e===fmt}">${e.toUpperCase()}</button>`).join("");
$("fmts").onclick=e=>{const b=e.target.closest("[data-f]");if(!b||busy)return;fmt=b.dataset.f;$("format-label").textContent=fmt.toUpperCase();document.querySelectorAll("#fmts .chip").forEach(c=>{c.classList.toggle("on",c===b);c.setAttribute("aria-pressed",String(c===b))});updateHints()};
$("quals").onclick=e=>{const b=e.target.closest("[data-q]");if(!b||busy)return;qual=b.dataset.q;document.querySelectorAll("#quals .chip").forEach(c=>{c.classList.toggle("on",c===b);c.setAttribute("aria-pressed",String(c===b))});updateHints()};

// ---- ffmpeg arguments
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

// ---- UI
const fmtSize=b=>b>1048576?(b/1048576).toFixed(1)+" MB":Math.max(1,Math.round(b/1024))+" KB";
function render(){
 const l=$("list");l.hidden=!files.length;$("empty").hidden=!!files.length;l.innerHTML="";
 $("queue-count").textContent=String(files.length);$("nav-count").textContent=String(files.length);
 files.forEach(f=>{
  const d=document.createElement("div");d.className="file";
  d.innerHTML='<div class="ico"></div><div class="mid"><div class="name"></div><div class="meta"></div><div class="bar" role="progressbar" aria-label="Conversion progress"><i></i></div></div><div class="st"></div><button class="remove-file" aria-label="Remove file">×</button>';
  d.querySelector(".ico").textContent=(f.file.name.split('.').pop()||'FILE').slice(0,5).toUpperCase();
  d.querySelector(".name").textContent=f.file.name;d.querySelector(".name").title=f.file.name;
  d.querySelector(".meta").textContent=fmtSize(f.file.size)+" · "+f.file.folder;
  d.querySelector(".meta").title=f.file.folder;
  const remove=d.querySelector('.remove-file');remove.disabled=busy;remove.setAttribute('aria-label','Remove '+f.file.name);
  remove.onclick=()=>{if(!busy){files=files.filter(item=>item!==f);render()}};
  f.el=d;l.appendChild(d);setSt(f,f.status||"Ready",f.cls);if(f.output)showSaved(f);setBar(f,f.p||0);
 });
 const pending=files.filter(f=>!f.done).length;
 $("go").disabled=busy||!pending;$("clear").disabled=busy||!files.length;
 $("go-label").textContent=busy?'Converting…':pending?`Convert ${pending} ${pending===1?'file':'files'}`:files.length?'All done — add more files':'Add files to begin';
 document.querySelectorAll('#fmts button,#quals button').forEach(b=>b.disabled=busy);$("fast").disabled=busy;
}
function setSt(f,t,c=""){f.status=t;f.cls=c;f.html=null;const s=f.el.querySelector(".st");s.className="st "+c;s.textContent=t}
function setBar(f,p){f.p=p;f.el.querySelector(".bar i").style.width=(p*100).toFixed(1)+"%";f.el.querySelector(".bar").setAttribute("aria-valuenow",String(Math.round(p*100)));f.el.querySelector(".bar").setAttribute("aria-valuemin","0");f.el.querySelector(".bar").setAttribute("aria-valuemax","100")}
function showSaved(f) {
 const status=f.el.querySelector(".st");status.className="st";status.textContent="";
 const button=document.createElement("button");button.className="sec";button.textContent="Show in folder";button.title=f.output;
 button.onclick=()=>window.desktop.reveal(f.file.id).catch(error=>{$("msg").textContent=error.message});
 status.appendChild(button);f.el.querySelector(".meta").textContent="Saved: "+f.output;
}
function addSelection(result,quietEmpty=false) {
 if(result.canceled||(quietEmpty&&!result.files.length&&!result.warnings.length))return;
 for(const file of result.files)if(!files.some(f=>f.file.id===file.id))files.push({file});
 render();
 if(result.files.length)$("converter").scrollIntoView({behavior:"smooth",block:"start"});
 if(result.warnings.length)$("msg").textContent="Some items could not be read: "+result.warnings.join("; ");
 else if(!result.files.length)$("msg").textContent="No supported media files found.";
 else $("msg").textContent="Added "+result.files.length+" media file(s). Output will be saved beside each original.";
}
async function importSelection(action,quietEmpty=false) {
 try { addSelection(await action(),quietEmpty); } catch(error) { $("msg").textContent="Could not add files: "+error.message; }
}
$("drop").onclick=()=>importSelection(()=>window.desktop.chooseFiles());
$("drop").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("drop").click()}};
$("folder").onclick=()=>importSelection(()=>window.desktop.chooseFolder());
["dragover","dragenter"].forEach(v=>document.addEventListener(v,e=>{e.preventDefault();$("drop").classList.add("over")}));
["dragleave","drop"].forEach(v=>document.addEventListener(v,e=>{e.preventDefault();$("drop").classList.remove("over")}));
document.addEventListener("drop",e=>{
 const dropped=Array.from(e.dataTransfer.files);
 importSelection(()=>window.desktop.importDrop(dropped));
});
$("clear").onclick=()=>{if(!busy){files=[];render()}};
window.desktop.onSelection(()=>importSelection(()=>window.desktop.pending(),true));
importSelection(()=>window.desktop.pending(),true);

// ---- engine
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

$("go").onclick=async()=>{
 if(busy)return;
 busy=true;$("go").disabled=true;$("clear").disabled=true;const ext=fmt,q=qual,batch=[...files];let succeeded=0,failed=0;render();
 try{await loadEngine()}catch(e){$("msg").textContent="Could not start the engine ("+e.message+"). Reload and try again.";$("diagnostics").style.display="block";$("diagnostics").open=true;busy=false;$("clear").disabled=false;render();return}
 const isMedia=["mp4","mov","mkv"].includes(ext);
 for(let i=0;i<batch.length;i++){const f=batch[i];if(f.done)continue;
  const inName="in_"+i+"."+(f.file.name.split(".").pop()||"bin"),outName="out_"+i+"."+ext;
  const onP=({progress})=>{if(progress>=0&&progress<=1)setBar(f,progress)};
  try{
   setBar(f,0);ffmpeg.on("progress",onP);
   await ffmpeg.writeFile(inName,await window.desktop.read(f.file.id));
   let data=null;
   if($("fast").checked&&isMedia){
    setSt(f,"Analyzing…");const p=await probe(inName);
    const vCopy=p.v==="h264",aCopy=!p.a||["aac","mp3"].includes(p.a);
    const a=[...MAPS,...(vCopy?["-c:v","copy"]:x264(q)),...(p.a?(aCopy?["-c:a","copy"]:["-c:a","aac","-b:a",Q[q].abr]):[]),...(ext==="mp4"?["-movflags","+faststart"]:[])];
    setSt(f,vCopy?"Fast copy…":"Re-encoding video…");
    data=await run(inName,outName,a);
    if(!data&&vCopy)setSt(f,"Copy failed, re-encoding…");
   }
   if(!data){setSt(f,"Converting…");setBar(f,0);data=await run(inName,outName,args(ext,q))}
   if(!data)throw new Error(tail());
   setSt(f,"Saving beside original…");
   f.output=await window.desktop.save(f.file.id,ext,data);
   setBar(f,1);f.done=true;f.status="Saved";succeeded++;showSaved(f);
  }catch(e){failed++;setSt(f,"Failed: "+e.message,"er");$("log").style.display="block"}
  finally{ffmpeg.off("progress",onP);await ffmpeg.deleteFile(inName).catch(()=>{});await ffmpeg.deleteFile(outName).catch(()=>{})}}
 busy=false;$("clear").disabled=false;render();$("msg").textContent=`Finished: ${succeeded} saved, ${failed} failed. Outputs are beside their original files.`;
};

function updateHints(){
 const audio=[...AUD].includes(fmt);
 const lossless=['wav','flac'].includes(fmt);
 $("quality-hint").textContent=lossless?'Lossless audio keeps its detail. Quality presets do not change this format.':fmt==='gif'?'GIF uses a fixed 12 fps, 480 px preset. Audio is removed.':({low:'A smaller file, with more compression.',medium:'A practical balance of size and quality.',high:'High quality, with a little more room to breathe.'})[qual];
 $("fast").closest('label').style.opacity=audio||!['mp4','mov','mkv'].includes(fmt)?'.65':'1';
 $("fast").closest('label').title=['mp4','mov','mkv'].includes(fmt)?'Compatible streams are copied, so quality settings may not apply.':'Smart fast mode applies to MP4, MOV, and MKV outputs.';
}
function showModal(id){document.getElementById(id).showModal()}
$("about").onclick=$("footer-about").onclick=()=>showModal('about-modal');
$("privacy").onclick=()=>showModal('privacy-modal');
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$("nav-convert").onclick=()=>{window.scrollTo({top:0,behavior:'smooth'});$("drop").focus()};
$("nav-files").onclick=()=>$("converter").scrollIntoView({behavior:"smooth",block:"start"});
function setTheme(theme){document.documentElement.dataset.theme=theme;$("theme").setAttribute('aria-label',`Switch to ${theme==='dark'?'light':'dark'} theme`);try{localStorage.setItem('mediaconvert-theme',theme)}catch{}}
let initialTheme='light';try{initialTheme=localStorage.getItem('mediaconvert-theme')||initialTheme}catch{}
setTheme(initialTheme);
$("theme").onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
if(window.desktop.info)window.desktop.info().then(info=>{$("version-label").textContent='MediaConvert '+info.version;$("about-version").textContent='Version '+info.version}).catch(()=>{});
render();updateHints();
