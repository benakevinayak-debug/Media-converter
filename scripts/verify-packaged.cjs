const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),asar=path.join(root,'dist/win-unpacked/resources/app.asar');
 const {AssetTools,encode}=require(path.join(asar,'desktop/asset-tools.cjs'));
 const sharp=require(path.join(asar,'node_modules/sharp'));
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'packaged-engines-'));
 try{
  const source=path.join(temporary,'sample.png');await sharp({create:{width:64,height:48,channels:3,background:'red'}}).png().toFile(source);
  const service=new AssetTools(),{files}=await service.collect('modern',[source]);const [image]=await service.run('modern',files.map(f=>f.id),{format:'avif'});assert.ok(!image.error,JSON.stringify(image));assert.equal((await sharp(image.output).metadata()).width,64);
  await encode(['-f','lavfi','-i','color=red:size=64x48:duration=0.1','-c:v','libx264',path.join(temporary,'sample.mp4')],temporary);
  const svg=path.join(temporary,'icon.svg');await fs.writeFile(svg,'<svg xmlns="http://www.w3.org/2000/svg"><!-- comment --><rect width="4" height="4"/></svg>');
  const selected=await service.collect('svg',[svg]);const [optimized]=await service.run('svg',selected.files.map(f=>f.id));assert.ok(!optimized.error,JSON.stringify(optimized));
  assert.ok((await fs.readFile(path.join(asar,'node_modules/lottie-web/build/player/lottie_light.min.js'))).length>1000);
  await fs.writeFile(path.join(root,'dist/packaged-smoke-report.json'),JSON.stringify({sharp:true,avif:true,ffmpeg:true,svgo:true,lottiePlayer:true}));
 }finally{await fs.rm(temporary,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
})().catch(e=>{console.error(e);process.exitCode=1});
