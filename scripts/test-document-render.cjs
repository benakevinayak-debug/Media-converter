const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {spawn}=require('node:child_process');
(async()=>{
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'render-report-')),report=path.join(temporary,'results.json');
 try{
  await new Promise((resolve,reject)=>{
   const child=spawn(require('electron'),['desktop/render-test.cjs'],{stdio:'inherit',env:{...process.env,MEDIACONVERT_RENDER_REPORT:report}});
   const timer=setTimeout(()=>{child.kill();reject(Error('Desktop document rendering tests timed out.'));},180000);
   child.on('error',error=>{clearTimeout(timer);reject(error)});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Desktop renderer tests failed: '+code))});
  });
  const results=JSON.parse(await fs.readFile(report,'utf8'));
  if(results.length!==7||!results.every(r=>r.passed))throw Error('Renderer did not produce all seven verified exports.');
  console.log('Verified desktop exports:',JSON.stringify(results));
 }finally{await fs.rm(temporary,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
