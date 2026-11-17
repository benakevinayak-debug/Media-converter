const fs=require('node:fs/promises');const path=require('node:path');const {pathToFileURL}=require('node:url');const {promisify}=require('node:util');const zlib=require('node:zlib');const {execFile}=require('node:child_process');const sharp=require('sharp');
sharp.cache({files:0});
const inflate=promisify(zlib.inflate),deflate=promisify(zlib.deflate),brotli=promisify(zlib.brotliCompress),unbrotli=promisify(zlib.brotliDecompress),execute=promisify(execFile);
const MAX_PIXELS=40000000,MAX_INFLATED=256*1048576;
const pngSignature=Buffer.from('89504e470d0a1a0a','hex');
function pngChunk(type,data){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4,'ascii');data.copy(out,8);out.writeUInt32BE(zlib.crc32(out.subarray(4,-4)),out.length-4);return out;}
function pngChunks(bytes){
 if(!bytes.subarray(0,8).equals(pngSignature))throw Error('Invalid PNG signature.');let offset=8;const chunks=[];
 while(offset<bytes.length){if(offset+12>bytes.length)throw Error('Truncated PNG chunk.');const n=bytes.readUInt32BE(offset);if(offset+n+12>bytes.length)throw Error('Invalid PNG chunk length.');const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+n);if(zlib.crc32(bytes.subarray(offset+4,offset+8+n))!==bytes.readUInt32BE(offset+8+n))throw Error('PNG checksum failed.');chunks.push({type,data});offset+=n+12;}
 if(chunks[0]?.type!=='IHDR'||chunks.at(-1)?.type!=='IEND')throw Error('Incomplete PNG image.');return chunks;
}
async function optimizePNG(bytes){
 const chunks=pngChunks(bytes),groups=[];let current=[];
 const finish=()=>{if(current.length)groups.push(current);current=[];};
 for(let i=0;i<chunks.length;i++){const {type}=chunks[i];if(type==='fcTL')finish();if(type==='IDAT'||type==='fdAT'){if(current.length&&chunks[current[0]].type!==type)finish();current.push(i);}}finish();
 if(!groups.length)throw Error('PNG has no image data.');
 for(const group of groups){const fd=chunks[group[0]].type==='fdAT',source=Buffer.concat(group.map(i=>chunks[i].data.subarray(fd?4:0)));const raw=await inflate(source,{maxOutputLength:MAX_INFLATED});
  const candidates=await Promise.all([deflate(raw,{level:9,strategy:zlib.constants.Z_DEFAULT_STRATEGY}),deflate(raw,{level:9,strategy:zlib.constants.Z_FILTERED})]);const best=candidates.sort((a,b)=>a.length-b.length)[0];
  if(best.length>=source.length||best.length<group.length)continue;
  let position=0;for(let j=0;j<group.length;j++){const i=group[j],remaining=best.length-position,take=Math.ceil(remaining/(group.length-j));const part=best.subarray(position,position+take);chunks[i].data=fd?Buffer.concat([chunks[i].data.subarray(0,4),part]):part;position+=take;}
 }
 return Buffer.concat([pngSignature,...chunks.map(c=>pngChunk(c.type,c.data))]);
}
function boxes(bytes,start=0,end=bytes.length){const list=[];for(let offset=start;offset<end;){if(offset+8>end)throw Error('Truncated image container.');let size=bytes.readUInt32BE(offset),header=8;if(size===1){if(offset+16>end)throw Error('Truncated extended box.');const big=bytes.readBigUInt64BE(offset+8);if(big>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Image box is too large.');size=Number(big);header=16;}if(size===0)size=end-offset;if(size<header||offset+size>end)throw Error('Invalid image container box.');list.push({type:bytes.toString('latin1',offset+4,offset+8),data:bytes.subarray(offset+header,offset+size),raw:bytes.subarray(offset,offset+size)});offset+=size;}return list;}
function box(type,data){const out=Buffer.alloc(data.length+8);out.writeUInt32BE(out.length);out.write(type,4,'latin1');data.copy(out,8);return out;}
function avifProperties(bytes){const result={};const visit=list=>{for(const b of list){if(['colr','irot','imir','auxC','pixi','ispe'].includes(b.type))(result[b.type]??=[]).push(b.data.toString('hex'));if(['iprp','ipco'].includes(b.type))visit(boxes(b.data));if(b.type==='meta')visit(boxes(b.data,4));}};visit(boxes(bytes));return result;}
function optimizeAVIFContainer(bytes){const list=boxes(bytes);if(!list.some(b=>b.type==='ftyp'&&/avif|avis/.test(b.data.toString('latin1'))))throw Error('This file is not an AVIF image.');while(list.at(-1)?.type==='free')list.pop();return Buffer.concat(list.map(b=>b.raw));}
async function optimizeJXL(bytes){
 if(bytes[0]===255&&bytes[1]===10)return bytes;
 const list=boxes(bytes);if(list[0]?.type!=='JXL '||!list[0].data.equals(Buffer.from('0d0a870a','hex'))||!list.some(b=>['jxlc','jxlp'].includes(b.type)))throw Error('Invalid JPEG XL container.');
 const out=[];for(const b of list){if(['Exif','xml '].includes(b.type)){const compressed=Buffer.concat([Buffer.from(b.type,'latin1'),await brotli(b.data,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:9}})]);out.push(compressed.length<b.data.length?box('brob',compressed):b.raw);}else out.push(b.raw);}return Buffer.concat(out);
}
async function jxlStructure(bytes){if(bytes[0]===255&&bytes[1]===10)return {codestream:bytes.toString('hex'),metadata:[]};const stream=[],metadata=[];for(const b of boxes(bytes)){if(['jxlc','jxlp'].includes(b.type))stream.push(b.raw.toString('hex'));else if(b.type==='brob'){if(b.data.length<4)throw Error('Invalid compressed JXL metadata.');metadata.push([b.data.toString('latin1',0,4),(await unbrotli(b.data.subarray(4),{maxOutputLength:MAX_INFLATED})).toString('hex')]);}else metadata.push([b.type,b.data.toString('hex')]);}return {codestream:stream.join(''),metadata};}
function optimizeWebPContainer(bytes){if(bytes.length<12||bytes.readUInt32LE(4)+8!==bytes.length)throw Error('Invalid WebP container size.');const chunks=[];for(let offset=12;offset<bytes.length;){if(offset+8>bytes.length)throw Error('Truncated WebP chunk.');const n=bytes.readUInt32LE(offset+4),end=offset+8+n+(n%2);if(end>bytes.length)throw Error('Invalid WebP chunk size.');if(bytes.toString('ascii',offset,offset+4)!=='JUNK')chunks.push(bytes.subarray(offset,end));offset=end;}const body=Buffer.concat([Buffer.from('WEBP'),...chunks]),header=Buffer.alloc(8);header.write('RIFF');header.writeUInt32LE(body.length,4);return Buffer.concat([header,body]);}
function avifAnimation(bytes){return boxes(bytes).some(b=>b.type==='moov'||(b.type==='ftyp'&&b.data.includes(Buffer.from('avis'))));}
function avifMovieInfo(bytes){const result={width:0,height:0,frames:0};const visit=list=>{for(const b of list){if(['moov','trak','mdia','minf','stbl'].includes(b.type))visit(boxes(b.data));if(b.type==='stsd')for(const sample of boxes(b.data,8))if(sample.type==='av01'&&sample.data.length>=28){result.width=Math.max(result.width,sample.data.readUInt16BE(24));result.height=Math.max(result.height,sample.data.readUInt16BE(26));}if(b.type==='stsz'&&b.data.length>=12)result.frames=Math.max(result.frames,b.data.readUInt32BE(8));}};visit(boxes(bytes));if(!result.width||!result.height||!result.frames)throw Error('Cannot verify animated AVIF dimensions and frame count. Source unchanged.');if(result.frames>300||result.width*result.height*result.frames>MAX_PIXELS)throw Error('Animation exceeds 300 frames or 40 megapixels of total frame pixels.');return result;}
async function avifThumbnail(bytes,temporary){const binary=require('ffmpeg-static').replace('app.asar','app.asar.unpacked'),source=path.join(temporary,'preview.avif'),destination=path.join(temporary,'preview.png');await fs.writeFile(source,bytes);await execute(binary,['-hide_banner','-loglevel','error','-y','-i',source,'-frames:v','1','-vf','scale=72:56:force_original_aspect_ratio=decrease',destination],{timeout:60000,windowsHide:true,maxBuffer:1048576});return fs.readFile(destination);}
let jxlPromise;
async function jxlCodec(){if(!jxlPromise)jxlPromise=(async()=>{const root=path.dirname(require.resolve('jxl-oxide-wasm/package.json'));const module=await import(pathToFileURL(path.join(root,'jxl_oxide_wasm.js')).href);await module.default({module_or_path:await fs.readFile(path.join(root,'jxl_oxide_wasm_bg.wasm'))});return module;})();return jxlPromise;}
async function inspectJXL(bytes){const {JxlImage}=await jxlCodec(),image=new JxlImage();try{image.feedBytes(bytes);if(!image.tryInit()||!image.loaded)throw Error('JPEG XL image is incomplete or unsupported.');if(!image.width||image.width*image.height>MAX_PIXELS)throw Error('Image exceeds the 40 megapixel limit.');const frame=image.render(0);let consumed=false;try{const icc=Buffer.from(frame.iccProfile);consumed=true;return {width:image.width,height:image.height,animated:image.animated,frames:image.numLoadedKeyframes,loops:image.numLoops,icc,png:Buffer.from(frame.encodeToPng())};}finally{if(!consumed)frame.free();}}finally{image.free();}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function failure(property){throw Error(`Cannot preserve ${property} with this compression request. Source unchanged; no compressed result was accepted.`);}
async function checkSharp(before,after,lossless){
 const input=sharp(before,{animated:true,limitInputPixels:MAX_PIXELS}),output=sharp(after,{animated:true,limitInputPixels:MAX_PIXELS});const a=await input.metadata(),b=await output.metadata();
 if((a.orientation||1)!==(b.orientation||1))failure('orientation');if((a.pages||1)!==(b.pages||1)||(a.pageHeight||a.height)!==(b.pageHeight||b.height))failure('animation frames');
 for(const property of ['format','width','height','hasAlpha','bitsPerSample','space'])if(!same(a[property],b[property]))failure(property);
 if(!same(a.delay,b.delay)||!same(a.loop,b.loop))failure('animation frame timing and looping');
 if(!(a.icc||Buffer.alloc(0)).equals(b.icc||Buffer.alloc(0)))failure('the original ICC color profile');
 if(lossless||a.hasAlpha){const left=await input.toColourspace('srgb').ensureAlpha().raw().toBuffer(),right=await output.toColourspace('srgb').ensureAlpha().raw().toBuffer();if(left.length!==right.length)failure('image channels');if(lossless&&!left.equals(right))failure('lossless pixel values');if(a.hasAlpha)for(let i=3;i<left.length;i+=4)if(left[i]!==right[i])failure('transparency');}
 return a;
}
function detect(bytes){if(bytes.subarray(0,8).equals(pngSignature))return 'png';if(bytes[0]===255&&bytes[1]===216)return 'jpeg';if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';if((bytes[0]===255&&bytes[1]===10)||bytes.toString('ascii',4,8)==='JXL ')return 'jxl';if(bytes.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(bytes.toString('latin1',8,Math.min(bytes.length,64))))return 'avif';throw Error('Unsupported or invalid image. Choose AVIF, JPEG XL, WebP, PNG or JPEG.');}
async function jpegLossless(bytes,temporary){let binary;if(process.platform==='win32'){const candidates=[process.resourcesPath&&path.join(process.resourcesPath,'native/jpegtran.exe'),path.resolve(__dirname,'../build/native/jpegtran.exe')].filter(Boolean);for(const candidate of candidates){try{await fs.access(candidate);binary=candidate;break;}catch{}}if(!binary)throw Error('The bundled lossless JPEG engine is missing. Reinstall QuickConvert Media.');}else binary=path.join(path.dirname(require.resolve('jpegtran-bin')),'vendor/jpegtran');const source=path.join(temporary,'input.jpg'),output=path.join(temporary,'output.jpg');await fs.writeFile(source,bytes);await execute(binary,['-copy','all','-optimize','-outfile',output,source],{timeout:60000,windowsHide:true,maxBuffer:1048576});return fs.readFile(output);}
async function compressImage(bytes,{mode='smart',temporary,progress=()=>{}}={}){
 if(!['smart','lossless'].includes(mode))throw Error('Unknown compression mode.');const format=detect(bytes);progress(15,'Inspecting image');
 let candidate,metadata,thumbnail,method;
 if(format==='avif'&&avifAnimation(bytes)){metadata={format,...avifMovieInfo(bytes),animated:true};progress(40,'Preserving AVIF animation');candidate=optimizeAVIFContainer(bytes);thumbnail=await avifThumbnail(bytes,temporary);method='Lossless animated AVIF container optimization';
 }else if(format==='jxl'){
  const info=await inspectJXL(bytes);metadata={format,width:info.width,height:info.height,frames:info.frames,animated:info.animated};progress(30,'Image ready','data:image/png;base64,'+(await sharp(info.png).resize(72,56,{fit:'inside'}).png().toBuffer()).toString('base64'));progress(45,'Optimizing JXL container');candidate=await optimizeJXL(bytes);if(!same(await jxlStructure(bytes),await jxlStructure(candidate)))failure('JPEG XL codestream and metadata');thumbnail=info.png;method='Lossless JXL metadata-container optimization';
 }else{
  const image=sharp(bytes,{animated:true,limitInputPixels:MAX_PIXELS});const m=await image.metadata();if((m.pages||1)>300)throw Error('Animations are limited to 300 frames.');if(m.width*m.height>MAX_PIXELS)throw Error('Image exceeds the 40 megapixel decoded-image limit.');metadata={format,width:m.width,height:m.pageHeight||m.height,frames:m.pages||1,animated:(m.pages||1)>1};thumbnail=await sharp(bytes,{limitInputPixels:MAX_PIXELS}).rotate().resize(72,56,{fit:'inside',withoutEnlargement:true}).png().toBuffer();progress(30,'Properties checked','data:image/png;base64,'+thumbnail.toString('base64'));progress(40,'Compressing image');
  if(format==='png'){candidate=await optimizePNG(bytes);method='Lossless PNG/APNG stream recompression';const old=pngChunks(bytes),next=pngChunks(candidate);const animation=old.find(c=>c.type==='acTL');if(animation){metadata.frames=animation.data.readUInt32BE(0);metadata.animated=true;metadata.loops=animation.data.readUInt32BE(4);if(metadata.width*metadata.height*metadata.frames>MAX_PIXELS)throw Error('Animation exceeds 40 megapixels of total frame pixels.');if(metadata.frames>300)throw Error('Animations are limited to 300 frames.');}if(!same(old.filter(c=>!['IDAT','fdAT'].includes(c.type)).map(c=>[c.type,c.data.toString('hex')]),next.filter(c=>!['IDAT','fdAT'].includes(c.type)).map(c=>[c.type,c.data.toString('hex')])))failure('PNG metadata, orientation and animation controls');}
  else if(format==='jpeg'){
   if(bytes.includes(Buffer.from('MPF\0')))throw Error('Multi-picture/gain-map JPEG cannot be safely preserved by this compressor. Source unchanged.');
   if(mode==='lossless'||m.space==='cmyk'){candidate=await jpegLossless(bytes,temporary);method='Lossless JPEG entropy optimization';await checkSharp(bytes,candidate,true);}
   else{candidate=await sharp(bytes).keepMetadata().jpeg({quality:82,mozjpeg:true,chromaSubsampling:'4:4:4'}).toBuffer();method='Smart JPEG quality 82';await checkSharp(bytes,candidate,false);}
  }else if(format==='webp'){
   if(mode==='lossless'){candidate=optimizeWebPContainer(bytes);method='Lossless WebP container optimization';}else{candidate=await image.keepMetadata().webp({quality:82,alphaQuality:100,lossless:mode==='lossless',effort:6,loop:m.loop,delay:m.delay}).toBuffer();method=mode==='lossless'?'Lossless WebP encoding':'Smart WebP quality 82';await checkSharp(bytes,candidate,false);}
  }else{
   const props=avifProperties(bytes),animated=boxes(bytes).some(b=>b.type==='moov'||(b.type==='ftyp'&&b.data.includes(Buffer.from('avis'))));metadata.animated=animated;
   if(mode==='lossless'||animated||m.hasAlpha||m.bitsPerSample!==8||props.irot||props.imir||props.auxC||props.colr){candidate=optimizeAVIFContainer(bytes);method='Lossless AVIF container optimization';}
   else{candidate=await sharp(bytes).keepMetadata().avif({quality:65,effort:6,bitdepth:8,chromaSubsampling:'4:4:4'}).toBuffer();method='Smart AVIF quality 65';await checkSharp(bytes,candidate,false);if(!same(props.colr,avifProperties(candidate).colr))failure('AVIF color information');}
  }
  thumbnail=await sharp(bytes,{limitInputPixels:MAX_PIXELS}).rotate().resize(72,56,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
 }
 progress(90,'Verifying preservation');
 // PNG and container-only routes retain the original image streams. No decoder round-trip can flatten animation or change precision.
 const noSavings=candidate.length>=bytes.length,result=noSavings?bytes:candidate;
 if(detect(result)!==format)failure('image format');
 const thumb=await sharp(thumbnail).resize(72,56,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
 return {bytes:result,format,metadata,thumbnail:'data:image/png;base64,'+thumb.toString('base64'),method,noSavings,originalSize:bytes.length,compressedSize:result.length,saved:bytes.length-result.length};
}
module.exports={compressImage,detect,boxes,box,pngChunks,pngChunk,pngSignature,optimizePNG,optimizeJXL,optimizeWebPContainer,jxlStructure,inspectJXL,avifProperties,checkSharp,avifMovieInfo,avifAnimation};
