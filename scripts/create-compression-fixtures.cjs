const fs=require('node:fs/promises');const path=require('node:path');const {pathToFileURL}=require('node:url');const sharp=require('sharp');const {box,pngChunk,pngChunks,pngSignature}=require('../desktop/compression-core.cjs');
(async()=>{
 const root=path.resolve(__dirname,'../desktop/compression-fixtures');await fs.mkdir(root,{recursive:true});
 const rgba=Buffer.alloc(96*64*4);for(let y=0;y<64;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4;rgba[i]=x*2;rgba[i+1]=y*3;rgba[i+2]=(x*y)%256;rgba[i+3]=(x%16)*17;}
 const image=sharp(rgba,{raw:{width:96,height:64,channels:4}});
 const png=await image.clone().withIccProfile('p3').withExif({IFD0:{Orientation:'6'}}).png({compressionLevel:0}).toBuffer();await fs.writeFile(path.join(root,'profile-alpha-oriented.png'),png);
 await image.clone().removeAlpha().withIccProfile('p3').withExif({IFD0:{Orientation:'6'}}).jpeg({quality:100,chromaSubsampling:'4:4:4',optimiseCoding:false}).toFile(path.join(root,'profile-oriented.jpeg'));
 await image.clone().withIccProfile('p3').withExif({IFD0:{Orientation:'6'}}).webp({lossless:true,effort:0}).toFile(path.join(root,'profile-alpha.webp'));
 const avif=await image.clone().removeAlpha().avif({lossless:true,effort:0,chromaSubsampling:'4:4:4'}).toBuffer();await fs.writeFile(path.join(root,'still.avif'),Buffer.concat([avif,box('free',Buffer.alloc(4096))]));
 const enc=await import(pathToFileURL(path.resolve('node_modules/@jsquash/jxl/encode.js')).href);await enc.init(await WebAssembly.compile(await fs.readFile('node_modules/@jsquash/jxl/codec/enc/jxl_enc.wasm')));
 const raw=Buffer.from(await enc.default({data:new Uint8ClampedArray(rgba),width:96,height:64},{lossless:true,effort:1}));
 const signature=box('JXL ',Buffer.from('0d0a870a','hex')),ftyp=box('ftyp',Buffer.from('6a786c20000000006a786c20','hex')),metadata=box('xml ',Buffer.from('<metadata>'+('creative asset metadata '.repeat(180))+'</metadata>'));
 await fs.writeFile(path.join(root,'alpha-metadata.jxl'),Buffer.concat([signature,ftyp,metadata,box('jxlc',raw)]));
 // Two real APNG frames with different delays, transparency, ICC and EXIF.
 const second=await image.clone().flop().png({compressionLevel:0}).toBuffer();const one=pngChunks(png),two=pngChunks(second);const ctl=(sequence,delay)=>{const b=Buffer.alloc(26);b.writeUInt32BE(sequence);b.writeUInt32BE(96,4);b.writeUInt32BE(64,8);b.writeUInt16BE(delay,20);b.writeUInt16BE(1000,22);return b;};const actl=Buffer.alloc(8);actl.writeUInt32BE(2);actl.writeUInt32BE(3,4);
 let seq=1;const chunks=[...one.filter(c=>!['IDAT','IEND'].includes(c.type)).map(c=>pngChunk(c.type,c.data)),pngChunk('acTL',actl),pngChunk('fcTL',ctl(0,70)),...one.filter(c=>c.type==='IDAT').map(c=>pngChunk(c.type,c.data)),pngChunk('fcTL',ctl(seq++,130)),...two.filter(c=>c.type==='IDAT').map(c=>{const s=Buffer.alloc(4);s.writeUInt32BE(seq++);return pngChunk('fdAT',Buffer.concat([s,c.data]))}),pngChunk('IEND',Buffer.alloc(0))];
 await fs.writeFile(path.join(root,'animated-profile.png'),Buffer.concat([pngSignature,...chunks]));
 await fs.writeFile(path.join(root,'broken.png'),Buffer.from('not an image'));
 console.log('Compression fixtures created.');
})().catch(e=>{console.error(e);process.exitCode=1});
