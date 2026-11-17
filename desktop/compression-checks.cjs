const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {createHash}=require('node:crypto');const sharp=require('sharp');const {promisify}=require('node:util');const inflate=promisify(require('node:zlib').inflate);const {ImageCompression}=require('./compression.cjs');const {pngChunks,jxlStructure,inspectJXL,boxes}=require('./compression-core.cjs');
const CASES=['profile-alpha-oriented.png','profile-oriented.jpeg','profile-alpha.webp','still.avif','alpha-metadata.jxl','animated-profile.png','animated-profile.webp','animated.avif','animated.jxl'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function verifyProperties(source,result,format,mode){
 if(format==='jxl'){assert.deepEqual(await jxlStructure(source),await jxlStructure(result));const a=await inspectJXL(source),b=await inspectJXL(result);for(const key of ['width','height','animated','frames','loops'])assert.equal(a[key],b[key]);assert.ok(a.icc.equals(b.icc));assert.ok(a.png.equals(b.png));return 'identical codestream/metadata, decoded first frame, dimensions, ICC, animation frames/loops';}
 if(format==='avif'){const original=boxes(source);while(original.at(-1)?.type==='free')original.pop();assert.ok(Buffer.concat(original.map(b=>b.raw)).equals(result));return 'exact container payload, color/orientation properties and all image/animation streams unchanged';}
 if(format==='png'){
  const pixels=async bytes=>{const groups=[];let current=[];for(const chunk of pngChunks(bytes)){if(chunk.type==='fcTL'&&current.length){groups.push(current);current=[];}if(chunk.type==='IDAT')current.push(chunk.data);if(chunk.type==='fdAT')current.push(chunk.data.subarray(4));}if(current.length)groups.push(current);const hashes=[];for(const group of groups)hashes.push(hash(await inflate(Buffer.concat(group),{maxOutputLength:256*1048576})));return hashes;};assert.deepEqual(await pixels(source),await pixels(result));
  const chunks=bytes=>pngChunks(bytes).filter(c=>!['IDAT','fdAT'].includes(c.type)).map(c=>[c.type,c.data.toString('hex')]);assert.deepEqual(chunks(source),chunks(result));return 'PNG metadata, ICC, orientation, bit depth, alpha and APNG controls retained; pixel streams recompressed without modification';}
 const a=await sharp(source,{animated:true}).metadata(),b=await sharp(result,{animated:true}).metadata();assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.equal(a.orientation||1,b.orientation||1);assert.deepEqual(a.icc,b.icc);assert.deepEqual(a.delay,b.delay);assert.equal(a.loop,b.loop);
 const left=await sharp(source,{animated:true}).toColourspace('srgb').ensureAlpha().raw().toBuffer(),right=await sharp(result,{animated:true}).toColourspace('srgb').ensureAlpha().raw().toBuffer();assert.equal(left.length,right.length);
 if(mode==='lossless')assert.ok(left.equals(right));if(a.hasAlpha)for(let i=3;i<left.length;i+=4)assert.equal(left[i],right[i]);
 return 'dimensions/orientation/ICC exact, alpha exact, animation frames/delays/loops retained'+(mode==='lossless'?', decoded pixels exact':'');
}
async function matrix({compression,mode,fixtureRoot=path.join(__dirname,'compression-fixtures')}){
 const results=[];
 for(const name of CASES){const sourcePath=path.join(fixtureRoot,name),source=await fs.readFile(sourcePath);const {files}=await compression.collect([sourcePath]);assert.equal(files.length,1,name);const [result]=await compression.run([files[0].id],mode);assert.equal(result.status,'done',`${name} (${mode}): ${result.error}`);const bytes=await fs.readFile(compression.ready(result.id).result);assert.equal(hash(await fs.readFile(sourcePath)),hash(source));assert.ok(bytes.length<=source.length);if(result.noSavings){assert.ok(bytes.equals(source));assert.equal(result.stage,'No size savings');}
  const properties=await verifyProperties(source,bytes,result.metadata.format,mode);results.push({file:name,mode,format:result.metadata.format,originalSize:source.length,resultSize:bytes.length,noSavings:result.noSavings,method:result.method,properties,passed:true,id:result.id});
 }
 return results;
}
async function verifyPackagedCompression({compression,window,reportPath,app}){
 assert.equal(process.platform,'win32','This report must be produced by the Windows app.');assert.equal(app.isPackaged,true,'The actual packaged EXE must run these checks.');
 const nav=await window.webContents.executeJavaScript(`(()=>{document.getElementById('nav-image-compression').click();return {ids:Array.from(document.querySelectorAll('.sidebar nav .nav-item')).slice(0,2).map(b=>b.id),visible:!document.getElementById('compression-page').hidden}})()`);
 assert.deepEqual(nav.ids,['nav-convert','nav-image-compression']);assert.equal(nav.visible,true);
 const fixtureRoot=path.join(__dirname,'compression-fixtures'),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'compression-app-proof-'));
 const other=new ImageCompression();let smart,lossless;
 try{
  // Start with a malformed image to prove later images still complete.
  const broken=await compression.collect([path.join(fixtureRoot,'broken.png')]);assert.equal((await compression.run(broken.files.map(f=>f.id)))[0].status,'failed');
  smart=await matrix({compression,mode:'smart'});lossless=await matrix({compression:other,mode:'lossless'});
  const one=smart.find(r=>r.format==='png');const saved=await compression.save(one.id,path.join(temporary,'export.png'));assert.ok((await fs.readFile(saved)).equals(await fs.readFile(compression.ready(one.id).result)));
  const zip=await compression.zip(smart.map(r=>r.id),path.join(temporary,'results.zip'));assert.ok((await fs.stat(zip)).size>0);
  await window.webContents.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>{document.getElementById('image-results-title').scrollIntoView({block:'start'});requestAnimationFrame(resolve)}))`);
  const ui=await window.webContents.executeJavaScript(`({count:document.querySelectorAll('.image-result').length,thumbnails:document.querySelectorAll('.image-thumb img').length,savings:document.getElementById('image-savings-total').textContent})`);assert.equal(ui.count,CASES.length+1);assert.equal(ui.thumbnails,CASES.length);
  const screenshot=path.join(path.dirname(reportPath),'image-compression.png');await fs.writeFile(screenshot,(await window.webContents.capturePage()).toPNG());
  const report={runtime:{platform:process.platform,arch:process.arch,packaged:app.isPackaged,version:app.getVersion()},smart,lossless,sidebarOrder:nav.ids,ui,saveBytesVerified:true,zipCreated:true,failedFileDidNotStopBatch:true,notes:['These checks ran inside the actual packaged Windows EXE, using its bundled codecs.','JXL and protected/animated AVIF use lossless container optimization; they do not re-encode image streams.','Native file-picker/Save-dialog clicks and physical installation/uninstallation were not automated.']};
  await fs.writeFile(reportPath,JSON.stringify(report,null,2));
 }finally{await other.dispose();await fs.rm(temporary,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
}
module.exports={CASES,matrix,verifyProperties,verifyPackagedCompression};
