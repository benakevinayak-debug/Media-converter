const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const sharp = require('sharp');
// Release image file handles promptly on Windows, including temporary frame files.
sharp.cache({files:0});
const { optimize } = require('svgo');
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const IMAGE = ['png','jpg','jpeg','webp','avif','gif','tif','tiff'];
const TOOLS = {
 svg: {extensions:['svg'], formats:['svg']}, gif:{extensions:['gif'],formats:['gif']},
 html:{extensions:['html','htm'],formats:['png','pdf','mp4','webm']},
 modern:{extensions:IMAGE,formats:['webp','avif']},
 apng:{extensions:['apng','png'],formats:['gif','webp','mp4']},
 lottie:{extensions:['json'],formats:['gif','mp4','png']},
 sprite:{extensions:['png','gif','webp','apng'],formats:['png']},
 sequence:{extensions:['png'],formats:['gif','webp','mp4','webm']},
 metadata:{extensions:IMAGE,formats:['original']},
 batch:{extensions:[...IMAGE,'svg'],formats:['original','webp','avif']}
};
const natural=(a,b)=>a.localeCompare(b,'en',{numeric:true,sensitivity:'base'});
function isAPNG(bytes){if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return false;for(let offset=8;offset+12<=bytes.length;){const length=bytes.readUInt32BE(offset);if(bytes.toString('ascii',offset+4,offset+8)==='acTL')return true;offset+=length+12;}return false;}
function number(value, fallback, min, max) { const n=value===undefined?fallback:Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(`Choose a value between ${min} and ${max}.`);return n; }
function options(tool, input={}) {
 if(!TOOLS[tool])throw Error('Unknown tool.');
 const format=input.format||TOOLS[tool].formats[0];if(!TOOLS[tool].formats.includes(format))throw Error('Unsupported output format.');
 return {format,quality:Math.round(number(input.quality,80,1,100)),colors:Math.round(number(input.colors,128,2,256)),fps:number(input.fps,24,1,30),duration:number(input.duration,3,.1,20),width:Math.round(number(input.width,1280,64,1920)),height:Math.round(number(input.height,720,64,1080)),columns:Math.round(number(input.columns,8,1,32))};
}
async function encode(args, cwd) {
 return new Promise((resolve,reject)=>{
  const child=spawn(ffmpegPath,['-hide_banner','-nostdin','-loglevel','error','-y',...args],{cwd,windowsHide:true,stdio:['ignore','ignore','pipe']});
  let log='';child.stderr.on('data',chunk=>{log=(log+chunk).slice(-3000)});
  const timer=setTimeout(()=>{child.kill();reject(Error('This asset exceeded the 5 minute processing limit.'));},300000);
  child.on('error',error=>{clearTimeout(timer);reject(error)});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(log||'Could not process this animation.'))});
 });
}
function videoArgs(format, quality=80) {
 if(format==='gif')return ['-filter_complex','[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0'];
 if(format==='webp')return ['-c:v','libwebp_anim','-quality',String(quality),'-loop','0'];
 const filter='pad=ceil(iw/2)*2:ceil(ih/2)*2:color=white,format=yuv420p';
 return ['-vf',filter,...(format==='webm'?['-c:v','libvpx-vp9','-crf','32','-b:v','0']:['-c:v','libx264','-preset','veryfast','-crf','23','-movflags','+faststart']),'-an'];
}
class AssetTools {
 constructor({render}={}){this.items=new Map();this.render=render;this.running=false;}
 async collect(tool,paths){
  if(!TOOLS[tool]||!Array.isArray(paths)||paths.some(p=>typeof p!=='string'))throw Error('Invalid asset selection.');
  const files=[],warnings=[],seen=new Set();
  const visit=async filename=>{
   try{const stat=await fs.lstat(filename);if(stat.isSymbolicLink())return;
    if(stat.isDirectory()){if(tool!=='batch')throw Error('Choose files for this tool.');for(const child of (await fs.readdir(filename)).sort(natural))await visit(path.join(filename,child));return;}
    if(!stat.isFile()||!TOOLS[tool].extensions.includes(path.extname(filename).slice(1).toLowerCase()))return;
    if(files.length>=500)throw Error('Select up to 500 files per batch.');
    if(stat.size>100*1048576)throw Error('Assets must be smaller than 100 MB.');
    const real=await fs.realpath(filename);if(seen.has(real))return;seen.add(real);
    const id=randomUUID();this.items.set(id,{path:real,tool});files.push({id,name:path.basename(real),size:stat.size,folder:path.dirname(real)});
   }catch(error){warnings.push(`${path.basename(filename)}: ${error.message}`)}
  };
  for(const filename of paths)await visit(path.resolve(filename));
  return {files,warnings};
 }
 item(id,tool){const item=this.items.get(id);if(!item||item.tool!==tool)throw Error('Choose these files again for this tool.');return item;}
 async save(item,ext,bytes){
  const p=path.parse(item.path);
  for(let n=0;;n++){
   const output=path.join(p.dir,`${p.name}${n?` (${n})`:''}.${ext}`);
   let handle;try{handle=await fs.open(output,'wx')}catch(e){if(e.code==='EEXIST')continue;throw e;}
   try{await handle.writeFile(bytes)}catch(e){await handle.close();await fs.unlink(output).catch(()=>{});throw e;}
   await handle.close();item.output=output;return output;
  }
 }
 async directory(item,source){
  const p=path.parse(item.path);
  for(let n=0;;n++){
   const output=path.join(p.dir,`${p.name}${n?` (${n})`:''}`);
   try{await fs.mkdir(output)}catch(e){if(e.code==='EEXIST')continue;throw e;}
   try{await fs.cp(source,output,{recursive:true})}catch(e){await fs.rm(output,{recursive:true,force:true});throw e;}
   item.output=output;return output;
  }
 }
 async image(item,tool,o){
  const bytes=await fs.readFile(item.path),ext=path.extname(item.path).slice(1).toLowerCase();
  if(ext==='svg'){
   if(bytes.length>2*1048576)throw Error('SVG optimization supports files up to 2 MB.');
   const result=optimize(bytes.toString('utf8'),{multipass:true,plugins:['removeComments','removeMetadata','removeXMLProcInst','removeDoctype']});
   const output=Buffer.from(result.data);return {ext:'svg',bytes:output.length<bytes.length?output:bytes};
  }
  if(isAPNG(bytes))throw Error('Use APNG Converter for animated PNG files to preserve all frames.');
  const image=sharp(bytes,{animated:true,limitInputPixels:160000000});const m=await image.metadata();
  if((m.pages||1)>300)throw Error('Use animations with no more than 300 frames.');
  const target=o.format==='original'?ext:o.format;
  if(target==='avif'&&(m.pages||1)>1)throw Error('AVIF export supports still images. Choose WebP to preserve animation.');
  const output=image.clone();if((m.pages||1)===1)output.autoOrient();
  let data;
  if(target==='gif')data=await output.gif({colours:o.colors,effort:7,dither:1,loop:m.loop,delay:m.delay}).toBuffer();
  else if(target==='webp')data=await output.webp({quality:o.quality,effort:5,loop:m.loop,delay:m.delay}).toBuffer();
  else if(target==='avif')data=await output.avif({quality:o.quality,effort:5}).toBuffer();
  else if(target==='png')data=await output.png({compressionLevel:9}).toBuffer();
  else if(['jpg','jpeg'].includes(target))data=await output.jpeg({quality:o.quality,mozjpeg:true}).toBuffer();
  else if(['tif','tiff'].includes(target))data=await output.tiff({compression:'lzw'}).toBuffer();
  else throw Error('Unsupported image type.');
  // Optimization never increases file size. Cleaning always emits fresh metadata-free pixels.
  if(tool!=='metadata'&&target===ext&&data.length>=bytes.length)data=bytes;
  return {ext:target,bytes:data};
 }
 async animation(item,tool,o,temporary,items){
  const output=path.join(temporary,'result.'+o.format);
  if(tool==='html'||tool==='lottie'){
   if(!this.render)throw Error('This tool needs the desktop rendering window.');
   const result=await this.render({tool,filename:item.path,options:o,temporary});
   if(result.bytes)return {ext:o.format,bytes:result.bytes};
   if(o.format==='png')return {directory:result.frames};
   await encode(['-framerate',String(o.fps),'-i',path.join(result.frames,'frame-%06d.png'),...videoArgs(o.format,o.quality),output],temporary);
  }else if(tool==='sequence'||tool==='sprite'){
   const frames=path.join(temporary,'frames');await fs.mkdir(frames);
   if(items.length===1&&tool==='sprite'&&/\.webp$/i.test(item.path)){
    const m=await sharp(item.path,{animated:true}).metadata();if((m.pages||1)>300)throw Error('Use animations with no more than 300 frames.');
    for(let i=0;i<(m.pages||1);i++)await sharp(item.path,{page:i,pages:1}).png().toFile(path.join(frames,`frame-${String(i+1).padStart(6,'0')}.png`));
   }else if(items.length===1&&tool==='sprite'){
    await encode(['-i',item.path,'-frames:v','301','-vsync','0',path.join(frames,'frame-%06d.png')],temporary);
   }else{
    if(items.some(item=>!/\.png$/i.test(item.path)))throw Error('For multiple frames, choose PNG files only.');
    const ordered=[...items].sort((a,b)=>natural(a.path,b.path));if(ordered.length>300)throw Error('Use up to 300 frames.');
    for(let i=0;i<ordered.length;i++){if(isAPNG(await fs.readFile(ordered[i].path)))throw Error('PNG sequences require still PNG frames. Use APNG Converter for animated PNG files.');await fs.copyFile(ordered[i].path,path.join(frames,`frame-${String(i+1).padStart(6,'0')}.png`));}
   }
   const names=(await fs.readdir(frames)).sort(natural);if(!names.length)throw Error('No animation frames found.');if(names.length>300)throw Error('Use animations with no more than 300 frames.');
   if(tool==='sprite'){
    const first=await sharp(path.join(frames,names[0])).metadata();const w=first.width,h=first.height,cols=Math.min(o.columns,names.length),rows=Math.ceil(names.length/cols);
    if(w*cols*h*rows>100000000||w*cols>16384||h*rows>16384)throw Error('Sprite sheet would be too large. Reduce frame sizes or count.');
    const overlays=[];for(let i=0;i<names.length;i++){
     const filename=path.join(frames,names[i]);const m=await sharp(filename).metadata();if(m.width!==w||m.height!==h)throw Error('All frames must have the same dimensions.');
     overlays.push({input:filename,left:i%cols*w,top:Math.floor(i/cols)*h});
    }
    return {ext:'png',bytes:await sharp({create:{width:w*cols,height:h*rows,channels:4,background:'#00000000'}}).composite(overlays).png().toBuffer(),details:`${names.length} frames · ${w}×${h} cells · ${cols} columns · ${rows} rows`};
   }
   const first=await sharp(path.join(frames,names[0])).metadata();
   for(const name of names){const m=await sharp(path.join(frames,name)).metadata();if(m.width!==first.width||m.height!==first.height)throw Error('All frames must have the same dimensions.');}
   await encode(['-framerate',String(o.fps),'-i',path.join(frames,'frame-%06d.png'),...videoArgs(o.format,o.quality),output],temporary);
  }else{
   await encode(['-i',item.path,...videoArgs(o.format,o.quality),output],temporary);
  }
  return {ext:o.format,bytes:await fs.readFile(output)};
 }
 async run(tool,ids,input={},progress=()=>{}){
  if(this.running)throw Error('Wait for the current tool to finish.');
  if(!Array.isArray(ids)||!ids.length||ids.length>500||new Set(ids).size!==ids.length)throw Error('Choose between 1 and 500 unique files.');
  const o=options(tool,input),items=ids.map(id=>this.item(id,tool));
  if(['html','lottie','apng'].includes(tool)&&items.length!==1)throw Error('Choose one source file for this tool.');
  this.running=true;const results=[];const jobs=['sprite','sequence'].includes(tool)?[items[0]]:items;
  try{for(let i=0;i<jobs.length;i++){
   const item=jobs[i];let temporary;
   try{
    progress({completed:i,total:jobs.length,name:path.basename(item.path)});
    temporary=await fs.mkdtemp(path.join(os.tmpdir(),'mediaconvert-assets-'));
    const result=['svg','gif','modern','metadata','batch'].includes(tool)?await this.image(item,tool,o):await this.animation(item,tool,o,temporary,items);
    const output=result.directory?await this.directory(item,result.directory):await this.save(item,result.ext,result.bytes);
    results.push({id:ids[items.indexOf(item)],name:path.basename(item.path),output,bytes:result.bytes?.length,details:result.details||''});
   }catch(error){results.push({id:ids[items.indexOf(item)],name:path.basename(item.path),error:error.message});}
   finally{if(temporary)await fs.rm(temporary,{recursive:true,force:true});}
  }}finally{this.running=false;}
  progress({completed:jobs.length,total:jobs.length});return results;
 }
}
module.exports={AssetTools,TOOLS,options,encode,videoArgs};
