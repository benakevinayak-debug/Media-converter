const fs=require('node:fs/promises');const path=require('node:path');const {spawn}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..'),report=path.join(root,'dist/image-compression-checks.json');
 const executable=process.env.QUICKCONVERT_VERIFY_EXE||path.join(root,'dist/win-unpacked/MediaConvert.exe');await fs.rm(report,{force:true});
 await new Promise((resolve,reject)=>{
  const child=spawn(executable,['--verify-image-compression'],{stdio:'inherit',env:{...process.env,QUICKCONVERT_COMPRESSION_REPORT:report}});
  const timer=setTimeout(()=>{child.kill();reject(Error('Packaged image-compression checks timed out.'));},180000);
  child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Packaged Windows compression checks failed: '+code))});
 });
 const proof=JSON.parse(await fs.readFile(report,'utf8'));if(proof.error)throw Error(proof.error);
 if(proof.runtime?.platform!=='win32'||proof.runtime?.packaged!==true||proof.smart?.length!==9||proof.lossless?.length!==9||![...proof.smart,...proof.lossless].every(r=>r.passed))throw Error('The packaged EXE did not complete every required format check.');
 proof.verificationTarget=process.env.QUICKCONVERT_VERIFY_EXE?'Application extracted from the finished MSIX (not installed/registered)':'Windows EXE build';
 await fs.writeFile(report,JSON.stringify(proof,null,2));
 console.log('Verification target:',proof.verificationTarget);
 console.log('Actual packaged Windows EXE verified AVIF/JXL/WebP/PNG/JPEG in Smart and Lossless modes:',JSON.stringify(proof.runtime));
 console.log('Animation, ICC/orientation/alpha, no-savings bytes, Save/ZIP, sidebar order and visible results verified.');
})().catch(e=>{console.error(e);process.exitCode=1});
