const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const sharp=require('sharp');const {AssetTools,encode,options}=require('./asset-tools.cjs');const {validateLottie}=require('./render-document.cjs');
async function setup(t){const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'assets-test-')));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100}));return root;}
async function run(service,tool,files,o={}){const chosen=await service.collect(tool,files);assert.equal(chosen.warnings.length,0);return service.run(tool,chosen.files.map(f=>f.id),o);}
const valid=results=>{for(const r of results)assert.ok(!r.error,JSON.stringify(results));return results;};
test('SVG optimizer preserves SMIL animation targets and never overwrites the source',async t=>{
 const root=await setup(t),file=path.join(root,'drawing.svg'),service=new AssetTools();
 const source='<svg xmlns="http://www.w3.org/2000/svg"><!-- '+ 'metadata '.repeat(40)+' --><rect id="shape" width="10" height="10"><animate attributeName="x" from="0" to="20" dur="2s" repeatCount="indefinite"/></rect></svg>';
 await fs.writeFile(file,source);const [r]=valid(await run(service,'svg',[file]));assert.equal(path.basename(r.output),'drawing (1).svg');const output=await fs.readFile(r.output,'utf8');assert.ok(output.length<source.length);assert.match(output,/id="shape"/);assert.match(output,/<animate /);assert.match(output,/repeatCount="indefinite"/);assert.equal(await fs.readFile(file,'utf8'),source);
});
test('modern conversion, metadata cleanup and batch exports use real image encoders',async t=>{
 const root=await setup(t),image=path.join(root,'Photo.final.jpg'),service=new AssetTools();
 await sharp({create:{width:64,height:48,channels:3,background:'red'}}).withExif({IFD0:{Artist:'Private author'}}).jpeg().toFile(image);
 const [clean]=valid(await run(service,'metadata',[image]));const meta=await sharp(clean.output).metadata();assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);assert.equal(meta.width,64);
 for(const format of ['webp','avif']){const [r]=valid(await run(service,'modern',[image],{format}));assert.equal(path.basename(r.output),'Photo.final.'+format);assert.equal((await sharp(r.output).metadata()).format,format==='avif'?'heif':format);}
 const batch=valid(await run(service,'batch',[root]));assert.ok(batch.length>=4);for(const item of batch)assert.ok((await fs.stat(item.output)).size>0);
});
test('GIF optimization preserves frames, delays and looping; animated AVIF is rejected',async t=>{
 const root=await setup(t),file=path.join(root,'motion.gif'),service=new AssetTools();
 await encode(['-f','lavfi','-i','testsrc2=size=64x48:rate=5:duration=0.6','-loop','0',file],root);
 const before=await sharp(file,{animated:true}).metadata();const [r]=valid(await run(service,'gif',[file],{colors:32}));const after=await sharp(r.output,{animated:true}).metadata();
 assert.equal(after.pages,before.pages);assert.deepEqual(after.delay,before.delay);assert.equal(after.loop,before.loop);assert.ok((await fs.stat(r.output)).size<=(await fs.stat(file)).size);
 const [webp]=valid(await run(service,'modern',[file],{format:'webp'}));assert.equal((await sharp(webp.output,{animated:true}).metadata()).pages,before.pages);
 assert.match((await run(service,'modern',[file],{format:'avif'}))[0].error,/still images/);
});
test('PNG sequences, sprite sheets and APNG exports produce decodable animations',async t=>{
 const root=await setup(t),service=new AssetTools();const frames=[];
 for(const [name,color] of [['frame10.png','blue'],['frame2.png','red']]){const f=path.join(root,name);await sharp({create:{width:64,height:48,channels:4,background:color}}).png().toFile(f);frames.push(f);}
 const [sprite]=valid(await run(service,'sprite',frames,{columns:2}));const m=await sharp(sprite.output).metadata();assert.equal(m.width,128);assert.equal(m.height,48);const pixel=await sharp(sprite.output).extract({left:0,top:0,width:1,height:1}).raw().toBuffer();assert.equal(pixel[0],255);assert.equal(pixel[2],0,'frame2 comes before frame10');
 for(const format of ['gif','webp','mp4','webm']){const [r]=valid(await run(service,'sequence',frames,{format,fps:5}));if(format==='webp')assert.ok((await sharp(r.output,{animated:true}).metadata()).pages>=2);else await encode(['-i',r.output,'-f','null','-'],root);}
 const apng=path.join(root,'animation.apng');await encode(['-f','lavfi','-i','testsrc2=size=64x48:rate=5:duration=0.6','-plays','0','-f','apng',apng],root);
 for(const format of ['gif','webp','mp4']){const [r]=valid(await run(service,'apng',[apng],{format}));if(format==='webp')assert.ok((await sharp(r.output,{animated:true}).metadata()).pages>=2);else await encode(['-i',r.output,'-f','null','-'],root);}
 const [animatedSprite]=valid(await run(service,'sprite',[apng],{columns:2}));assert.match(animatedSprite.details,/3 frames/);
});
test('tool capabilities reject forged selections, unsupported options and external Lottie assets',async t=>{
 const root=await setup(t),service=new AssetTools();await assert.rejects(service.run('modern',['forged']),/Choose these files/);
 assert.throws(()=>options('modern',{format:'exe'}),/Unsupported/);assert.throws(()=>options('html',{width:99999}),/between/);
 const data={w:100,h:100,ip:0,op:30,fr:30,layers:[]};assert.equal(validateLottie(data),data);
 assert.throws(()=>validateLottie({...data,assets:[{u:'https://example.com/',p:'image.png'}]}),/embedded/);
 assert.throws(()=>validateLottie({...data,layers:[{x:'alert(1)'}]}),/expressions/);
});
