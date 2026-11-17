const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..');
 if(process.argv[2]!=='--verify-extracted'){
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'packaged-engines-')),extracted=path.join(temporary,'application');
  try{
   console.log('Extracting the packaged application and native binaries.');
   require('@electron/asar').extractAll(path.join(root,'dist/win-unpacked/resources/app.asar'),extracted);
   // A child loads the native DLLs, so Windows releases their locks before cleanup.
   await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[__filename,'--verify-extracted',extracted,temporary],{stdio:'inherit'});
    const timer=setTimeout(()=>{child.kill();reject(Error('Packaged dependency verification timed out.'));},120000);
    child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Packaged dependency verification failed: '+code))});
   });
  }finally{await fs.rm(temporary,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
  return;
 }
 const extracted=process.argv[3],temporary=path.join(process.argv[4],'work');await fs.mkdir(temporary);
 const {AssetTools,encode}=require(path.join(extracted,'desktop/asset-tools.cjs'));
 const sharp=require(path.join(extracted,'node_modules/sharp'));
 console.log('Checking packaged Sharp and AVIF encoding.');
 const source=path.join(temporary,'sample.png');await sharp({create:{width:64,height:48,channels:3,background:'red'}}).png().toFile(source);
 const service=new AssetTools(),{files}=await service.collect('modern',[source]);const [image]=await service.run('modern',files.map(f=>f.id),{format:'avif'});assert.ok(!image.error,JSON.stringify(image));assert.equal((await sharp(image.output).metadata()).width,64);
 console.log('Checking packaged FFmpeg encoding.');
 await encode(['-f','lavfi','-i','color=red:size=64x48:duration=0.1','-c:v','libx264',path.join(temporary,'sample.mp4')],temporary);
 const svg=path.join(temporary,'icon.svg');await fs.writeFile(svg,'<svg xmlns="http://www.w3.org/2000/svg"><!-- comment --><rect width="4" height="4"/></svg>');
 const selected=await service.collect('svg',[svg]);const [optimized]=await service.run('svg',selected.files.map(f=>f.id));assert.ok(!optimized.error,JSON.stringify(optimized));
 assert.ok((await fs.readFile(path.join(extracted,'node_modules/lottie-web/build/player/lottie_light.min.js'))).length>1000);
 await fs.writeFile(path.join(root,'dist/packaged-smoke-report.json'),JSON.stringify({sharp:true,avif:true,ffmpeg:true,svgo:true,lottiePlayer:true}));
 console.log('Packaged native encoders and Lottie player verified.');
})().catch(e=>{console.error(e);process.exitCode=1});
