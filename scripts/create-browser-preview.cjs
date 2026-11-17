const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');const source=path.join(root,'desktop');
 let html=await fs.readFile(path.join(source,'index.html'),'utf8');
 const css=await fs.readFile(path.join(source,'styles.css'),'utf8');
 const renderer=await fs.readFile(path.join(source,'renderer.js'),'utf8');
 const toolScript=await fs.readFile(path.join(source,'tools.js'),'utf8');
 const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
 const bridge=`window.DESIGN_PREVIEW=true;(()=>{
  let counter=0;
  const media=/\\.(mp4|mov|mkv|webm|avi|gif|mp3|wav|flac|aac|m4a|ogg|opus|wmv|flv|ts|3gp|wma|aiff|aif|hevc|m2ts|mts|mpeg|mpg|m4v|mka|oga|vob)$/i;
  const selection=files=>({files:Array.from(files).filter(f=>media.test(f.name)).map(f=>({id:'preview-'+(++counter),name:f.name,size:f.size,type:f.type||'application/octet-stream',folder:f.webkitRelativePath?.split('/').slice(0,-1).join('/')||'Browser preview'})),warnings:[]});
  function choose(folder){return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.multiple=true;input.hidden=true;if(folder)input.setAttribute('webkitdirectory','');else input.accept='video/*,audio/*,.gif,.mkv,.flac';input.onchange=()=>{const result=selection(input.files);input.remove();resolve(result)};input.oncancel=()=>{input.remove();resolve({files:[],warnings:[],canceled:true})};document.body.appendChild(input);input.click()})}
  window.desktop={info:async()=>({version:${JSON.stringify(version)}}),pending:async()=>({files:[],warnings:[]}),onSelection:()=>()=>{},chooseFiles:()=>choose(false),chooseFolder:()=>choose(true),importDrop:async files=>selection(files),read:async()=>{throw Error('Use the Windows app to convert')},save:async()=>{throw Error('Use the Windows app to save')},reveal:async()=>{}};
 })();`;
 html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src \'self\' data:;">');
 html=html.replace('<link rel="stylesheet" href="styles.css">',()=>'<style>'+css+'</style>');
 html=html.replace('<script src="vendor/ffmpeg/ffmpeg.js"></script><script src="renderer.js"></script><script src="tools.js"></script>',()=>'<script>'+bridge+'</script><script>'+renderer+'</script><script>'+toolScript+'</script>');
 html=html.replace('<title>MediaConvert — by Vinayak Benake</title>','<title>MediaConvert 1.3 — Desktop UI Preview</title>');
 await fs.mkdir(path.join(root,'preview'),{recursive:true});await fs.writeFile(path.join(root,'preview/MediaConvert-Preview.html'),html);
 console.log('Created self-contained desktop UI preview:',Buffer.byteLength(html),'bytes');
})().catch(error=>{console.error(error);process.exitCode=1});
