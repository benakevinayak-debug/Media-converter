const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {randomUUID,createHash}=require('node:crypto');const {pipeline}=require('node:stream/promises');const yazl=require('yazl');const {compressImage}=require('./compression-core.cjs');
const EXTENSIONS=['avif','jxl','webp','png','jpg','jpeg'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function uniqueName(name,used){const parsed=path.parse(path.basename(name));let result=parsed.base,n=0;while(used.has(result.normalize('NFC').toLocaleLowerCase('en-US')))result=`${parsed.name} (${++n})${parsed.ext}`;used.add(result.normalize('NFC').toLocaleLowerCase('en-US'));return result;}
async function writeExclusive(filename,write){const parsed=path.parse(filename);for(let n=0;;n++){const destination=path.join(parsed.dir,`${parsed.name}${n?` (${n})`:''}${parsed.ext}`);let handle;try{handle=await fs.open(destination,'wx')}catch(e){if(e.code==='EEXIST')continue;throw e;}try{await write(handle)}catch(e){await handle.close();await fs.unlink(destination).catch(()=>{});throw e;}await handle.close();return destination;}}
class ImageCompression{
 constructor({progress=()=>{}}={}){this.items=new Map();this.running=false;this.progress=progress;this.temporary=null;}
 view(item){return {id:item.id,name:item.name,folder:path.dirname(item.source),originalSize:item.originalSize,status:item.status,progress:item.progress||0,stage:item.stage||'',error:item.error,compressedSize:item.compressedSize,saved:item.saved,noSavings:item.noSavings,thumbnail:item.thumbnail,method:item.method,metadata:item.metadata,savePath:item.savePath};}
 emit(item){this.progress(this.view(item));}
 async collect(paths){
  if(this.running)throw Error('Wait for the current batch before adding images.');if(!Array.isArray(paths)||paths.some(p=>typeof p!=='string'))throw Error('Invalid image selection.');
  const files=[],warnings=[],seen=new Set([...this.items.values()].map(i=>i.source));let total=[...this.items.values()].reduce((n,i)=>n+i.originalSize,0);
  const visit=async(filename,depth=0)=>{if(depth>32){warnings.push('Folder nesting exceeds 32 levels.');return;}try{const stat=await fs.lstat(filename);if(stat.isSymbolicLink())return;if(stat.isDirectory()){for(const child of (await fs.readdir(filename)).sort())await visit(path.join(filename,child),depth+1);return;}if(!stat.isFile())return;if(!EXTENSIONS.includes(path.extname(filename).slice(1).toLowerCase())){warnings.push(`${path.basename(filename)}: unsupported image format.`);return;}
   const source=await fs.realpath(filename);if(seen.has(source))return;seen.add(source);if(this.items.size>=500)throw Error('This batch is limited to 500 images.');if(stat.size>50*1048576)throw Error('Image exceeds 50 MB.');if(total+stat.size>1073741824)throw Error('Batch exceeds 1 GB.');total+=stat.size;
   const item={id:randomUUID(),name:path.basename(source),source,originalSize:stat.size,mtime:stat.mtimeMs,status:'queued'};this.items.set(item.id,item);files.push(this.view(item));this.emit(item);
  }catch(e){warnings.push(`${path.basename(filename)}: ${e.message}`)}};
  for(const filename of paths)await visit(path.resolve(filename));return {files,warnings};
 }
 item(id){const item=this.items.get(id);if(!item)throw Error('Add this image again.');return item;}
 async run(ids,mode='smart'){
  if(this.running)throw Error('A compression batch is already running.');if(!['smart','lossless'].includes(mode))throw Error('Choose Smart or Lossless mode.');if(!Array.isArray(ids)||!ids.length||ids.length>500||new Set(ids).size!==ids.length)throw Error('Choose a valid image batch.');const items=ids.map(id=>this.item(id));
  this.running=true;
  try{if(!this.temporary)this.temporary=await fs.mkdtemp(path.join(os.tmpdir(),'quickconvert-compression-'));
   for(const item of items){let directory;try{
    item.status='working';item.error=null;item.progress=3;item.stage='Reading source';this.emit(item);const stat=await fs.stat(item.source);if(stat.size!==item.originalSize||stat.mtimeMs!==item.mtime)throw Error('The source changed after selection. Clear the batch and add it again.');
    const bytes=await fs.readFile(item.source);if(bytes.length!==item.originalSize)throw Error('The source changed while reading. Add it again.');
    directory=path.join(this.temporary,randomUUID());await fs.mkdir(directory);
    const result=await compressImage(bytes,{mode,temporary:directory,progress:(value,stage,thumbnail)=>{if(thumbnail)item.thumbnail=thumbnail;item.progress=value;item.stage=stage;this.emit(item)}});
    const ext=path.extname(item.name).slice(1).toLowerCase();if(result.format!==(ext==='jpg'?'jpeg':ext))throw Error('The filename extension does not match the image format. Rename the source correctly and add it again.');
    const output=path.join(this.temporary,item.id+'.result');await fs.writeFile(output,result.bytes);item.result=output;item.sourceHash=hash(bytes);const {bytes:_bytes,...details}=result;Object.assign(item,details,{status:'done',progress:100,stage:result.noSavings?'No size savings':'Compressed'});this.emit(item);
   }catch(e){item.status='failed';item.progress=100;item.stage='Failed';item.error=e.message;this.emit(item);}
   finally{if(directory)await fs.rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
   }
  }finally{this.running=false;}
  return items.map(item=>this.view(item));
 }
 ready(id){const item=this.item(id);if(item.status!=='done'||!item.result)throw Error('Compress this image successfully before saving.');return item;}
 async suggested(id){const item=this.ready(id),used=new Set();let target=path.join(path.dirname(item.source),item.name);while(true){try{await fs.access(target);target=path.join(path.dirname(item.source),uniqueName(item.name,used));}catch(e){if(e.code==='ENOENT')return target;throw e;}}}
 async save(id,filename){const item=this.ready(id);if(!EXTENSIONS.includes(path.extname(filename).slice(1).toLowerCase())||!(['jpg','jpeg'].includes(path.extname(item.name).slice(1).toLowerCase())&&['jpg','jpeg'].includes(path.extname(filename).slice(1).toLowerCase()))&&path.extname(filename).toLowerCase()!==path.extname(item.name).toLowerCase())throw Error('Keep the original image format when saving.');const bytes=await fs.readFile(item.result);item.savePath=await writeExclusive(filename,handle=>handle.writeFile(bytes));this.emit(item);return item.savePath;}
 async zip(ids,filename){if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Choose compressed images to save.');const items=ids.map(id=>this.ready(id));if(path.extname(filename).toLowerCase()!=='.zip')throw Error('Choose a .zip filename.');const used=new Set(),zip=new yazl.ZipFile();zip.on('error',error=>zip.outputStream.destroy(error));for(const item of items)zip.addFile(item.result,uniqueName(item.name,used),{compress:false});
  return writeExclusive(filename,async handle=>{const stream=handle.createWriteStream({autoClose:true});const done=pipeline(zip.outputStream,stream);zip.end();await done;});
 }
 async clear(){if(this.running)throw Error('Wait for the batch to finish before clearing.');this.items.clear();if(this.temporary)await fs.rm(this.temporary,{recursive:true,force:true,maxRetries:3,retryDelay:100});this.temporary=null;}
 async dispose(){if(this.temporary)await fs.rm(this.temporary,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});}
}
module.exports={ImageCompression,EXTENSIONS,uniqueName,writeExclusive};
