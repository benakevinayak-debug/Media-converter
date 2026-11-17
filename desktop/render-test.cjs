const {app,BrowserWindow,session}=require('electron');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');const sharp=require('sharp');
const {createDocumentRenderer}=require('./render-document.cjs');const {AssetTools,encode}=require('./asset-tools.cjs');
app.whenReady().then(async()=>{
 const report=[];
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'document-test-'));
 try{
  const render=createDocumentRenderer({BrowserWindow,session});const service=new AssetTools({render});
  const html=path.join(root,'Preview.html');await fs.writeFile(html,'<style>body{margin:0;background:#ff0000}.box{width:32px;height:32px;background:blue;animation:slide 1s linear infinite}@keyframes slide{to{transform:translateX(100px)}}</style><div class="box"></div><script>document.body.style.background="green"</script>');
  const lottie=path.join(root,'Logo.json');await fs.writeFile(lottie,JSON.stringify({v:'5.12.0',fr:5,ip:0,op:3,w:64,h:64,nm:'sample',ddd:0,assets:[],layers:[{ddd:0,ind:1,ty:1,nm:'red solid',sr:1,ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[0,0,0]},a:{a:0,k:[0,0,0]},s:{a:0,k:[100,100,100]}},sw:64,sh:64,sc:'#ff0000',ip:0,op:3,st:0,bm:0}]}));
  for(const [tool,file,formats] of [['html',html,['png','pdf','mp4','webm']],['lottie',lottie,['gif','mp4','png']]]){
   for(const format of formats){
    const {files}=await service.collect(tool,[file]);const [result]=await service.run(tool,files.map(f=>f.id),{format,width:64,height:64,fps:5,duration:.6});assert.ok(!result.error,JSON.stringify(result));
    if(format==='pdf')assert.equal((await fs.readFile(result.output)).subarray(0,4).toString(),'%PDF');
    else if(format==='png'&&tool==='lottie'){const names=await fs.readdir(result.output);assert.equal(names.length,3);const m=await sharp(path.join(result.output,names[0])).metadata();assert.equal(m.width,64);}
    else if(format==='png'){const pixel=await sharp(result.output).extract({left:40,top:40,width:1,height:1}).raw().toBuffer();assert.equal(pixel[0],255);assert.equal(pixel[1],0,'Untrusted HTML scripts stay disabled');}
    else await encode(['-i',result.output,'-f','null','-'],root);
    report.push({tool,format,passed:true});console.log(`PASS ${tool} -> ${format}`);
   }
  }
 }finally{await fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
 await fs.writeFile(process.env.MEDIACONVERT_RENDER_REPORT,JSON.stringify(report));
}).then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)});
