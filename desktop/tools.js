(()=>{
const catalog=[
 {id:'svg',name:'SVG Optimizer',icon:'image-icon',description:'Reduce SVG size while keeping animation IDs, keyframes, styles and geometry intact.',formats:['svg'],note:'Conservative cleanup removes comments, metadata and redundant XML formatting. Animation and drawing data stay intact.'},
 {id:'gif',name:'GIF Optimizer',icon:'image-icon',description:'Reduce palette size while preserving animation timing and looping.',formats:['gif'],fields:['colors'],note:'Keeps all frames, delays and looping. Lower palette sizes can reduce color detail. If compression makes the file larger, the original bytes are kept.'},
 {id:'html',name:'HTML Converter',icon:'tools-icon',description:'Export a self-contained HTML page to PNG, PDF, MP4 or WebM.',formats:['png','pdf','mp4','webm'],fields:['width','height','fps','duration'],note:'Inline CSS and embedded data images/fonts are supported. External resources and JavaScript are disabled. PNG captures the viewport; PDF prints the page. Videos capture CSS animations for the chosen duration (up to 20 seconds).'},
 {id:'modern',name:'WebP / AVIF Converter',icon:'image-icon',description:'Convert and compress images using modern formats.',formats:['webp','avif'],fields:['quality'],note:'WebP preserves supported GIF/WebP animation. AVIF export supports still images. Use APNG Converter for animated PNG inputs. JPEG/WebP/AVIF compression can change image detail.'},
 {id:'apng',name:'APNG Converter',icon:'image-icon',description:'Convert animated PNG into GIF, animated WebP or MP4.',formats:['gif','webp','mp4'],fields:['quality'],note:'Keeps source animation timing. MP4 uses an opaque background and even dimensions; GIF uses a palette. Transparent output is available in GIF/WebP.'},
 {id:'lottie',name:'Lottie Converter',icon:'play',description:'Export supported Lottie JSON to GIF, MP4 or PNG frames.',formats:['gif','mp4','png'],fields:['width','height','fps'],note:'Supports keyframe-based SVG Lottie animations up to 20 seconds. Use embedded image assets. Expressions, layer effects and external fonts/assets are rejected. PNG exports a numbered image-sequence folder.'},
 {id:'sprite',name:'Sprite Sheet Generator',icon:'tools-icon',description:'Arrange animation frames in a transparent PNG grid.',formats:['png'],fields:['columns'],note:'Choose one GIF/APNG/WebP animation or multiple equal-sized PNG frames (up to 300). PNG files use natural filename order, for example frame2 before frame10. The result reports cell dimensions, columns and rows.'},
 {id:'sequence',name:'PNG Sequence Converter',icon:'play',description:'Turn numbered PNG frames into GIF, WebP, MP4 or WebM.',formats:['gif','webp','mp4','webm'],fields:['fps','quality'],note:'Select up to 300 equal-sized PNG frames. Files use natural filename order. Frame rate controls playback speed. MP4/WebM exports use opaque backgrounds.'},
 {id:'metadata',name:'Image Metadata Cleaner',icon:'shield',description:'Remove EXIF, GPS, XMP, comments and embedded image profiles.',formats:['original'],fields:['quality'],note:'Re-encodes image pixels without optional metadata; image dimensions and animation timing remain. Still-image orientation is applied before removal. JPEG/WebP/AVIF quality controls re-encoding; the cleaned file may be larger. Animated PNG inputs should use APNG Converter.'},
 {id:'batch',name:'Batch Asset Optimizer',icon:'folder-icon',description:'Optimize up to 500 images and SVGs from files or a folder.',formats:['original','webp','avif'],fields:['quality','colors'],folder:true,note:'Processes files one at a time, including subfolders, and saves beside each source. Keep format preserves animation; WebP supports animated GIF/WebP inputs. SVGs use conservative SVG optimization. AVIF rejects animated inputs. Per-file failures do not stop the batch.'}
];
let active=null,selection=[],running=false;
const grid=$('asset-tool-grid');
for(const tool of catalog){const b=document.createElement('button');b.className='asset-tool-card';b.innerHTML=icon(tool.icon)+'<strong></strong><span></span>';b.querySelector('strong').textContent=tool.name;b.querySelector('span').textContent=tool.description;b.onclick=()=>open(tool);grid.appendChild(b)}
const inputs={quality:$('asset-quality'),colors:$('asset-colors'),width:$('asset-width'),height:$('asset-height'),fps:$('asset-fps'),duration:$('asset-duration'),columns:$('asset-columns')};
function update(){
 const blocked=running||busy;$('asset-choose').disabled=blocked;$('asset-folder').disabled=blocked;$('asset-run').disabled=blocked||!selection.length||preview;$('asset-options').disabled=blocked;$('asset-back').disabled=running;
 document.querySelectorAll('.asset-tool-card').forEach(b=>b.disabled=running);
 $('asset-selection-count').textContent=`${selection.length} ${selection.length===1?'file':'files'} selected`;
 $('asset-run').textContent=preview?'Windows app required':running?'Processing…':'Run '+(active?.name||'tool');
}
function open(tool){
 active=tool;selection=[];$('asset-tool-grid').hidden=true;$('asset-detail').hidden=false;$('asset-title').textContent=tool.name;$('asset-description').textContent=tool.note;
 $('asset-results').replaceChildren();$('asset-selection').replaceChildren();$('asset-status').textContent='Choose source files to begin.';$('asset-format').replaceChildren();
 for(const value of tool.formats){const opt=document.createElement('option');opt.value=value;opt.textContent=value==='original'?'Keep original format':value==='png'&&tool.id==='lottie'?'PNG image sequence':value.toUpperCase();$('asset-format').appendChild(opt)}
 for(const [key,input] of Object.entries(inputs)){input.value=input.defaultValue;input.closest('label').hidden=!(tool.fields||[]).includes(key);input.disabled=!(tool.fields||[]).includes(key);}
 $('asset-folder').hidden=!tool.folder;update();$('asset-title').focus();
}
$('asset-back').onclick=()=>{if(running)return;active=null;selection=[];$('asset-detail').hidden=true;$('asset-tool-grid').hidden=false;};
async function choose(folder){
 if(!window.desktop.chooseAssets){$('asset-status').textContent='Use the Windows application to select assets for these tools.';return;}
 try{const result=await window.desktop.chooseAssets(active.id,folder);if(result.canceled)return;selection=result.files;$('asset-selection').replaceChildren();
  for(const file of selection){const li=document.createElement('li');li.textContent=`${file.name} · ${fmtSize(file.size)}`;li.title=file.folder;$('asset-selection').appendChild(li)}
  $('asset-status').textContent=result.warnings?.length?result.warnings.join('; '):selection.length?'Ready. Outputs keep the source filename and save beside originals.':'No supported files found.';update();
 }catch(error){$('asset-status').textContent=error.message}
}
$('asset-choose').onclick=()=>choose(false);$('asset-folder').onclick=()=>choose(true);
$('asset-run').onclick=async()=>{
 if(running||busy||preview||!selection.length)return;
 const o={format:$('asset-format').value};for(const [key,input] of Object.entries(inputs))if((active.fields||[]).includes(key))o[key]=Number(input.value);
 if(!$('asset-options').reportValidity())return;
 running=true;window.assetToolBusy=true;update();updateTotals();$('asset-results').replaceChildren();$('asset-status').textContent='Processing locally…';
 try{const results=await window.desktop.runTool(active.id,selection.map(f=>f.id),o);
  for(const result of results){const li=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('span');title.textContent=result.name;detail.textContent=result.error?'Failed: '+result.error:result.output+(result.details?' · '+result.details:'');li.className=result.error?'asset-error':'asset-success';li.append(title,detail);
   if(!result.error){const b=document.createElement('button');b.className='text-button';b.textContent='Show in folder';b.onclick=()=>window.desktop.revealAsset(result.id).catch(e=>{$('asset-status').textContent=e.message});li.appendChild(b)}
   $('asset-results').appendChild(li);
  }
  $('asset-status').textContent=`Finished. ${results.filter(r=>!r.error).length} saved, ${results.filter(r=>r.error).length} failed. Originals are kept.`;
 }catch(error){$('asset-status').textContent='Could not finish: '+error.message}
 finally{running=false;window.assetToolBusy=false;update();updateTotals()}
};
window.desktop.onToolProgress?.(p=>{if(running)$('asset-status').textContent=`Processing ${Math.min(p.completed+1,p.total)} of ${p.total}${p.name?' · '+p.name:''}…`});
window.refreshAssetTools=update;
})();
