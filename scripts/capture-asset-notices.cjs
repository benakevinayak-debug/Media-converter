const fs=require('node:fs/promises');const path=require('node:path');const {execFileSync}=require('node:child_process');
(async()=>{
 const dest=path.resolve('licenses/asset-tools');await fs.mkdir(dest,{recursive:true});
 for(const [module,names] of Object.entries({'sharp':['LICENSE'],'svgo':['LICENSE'],'lottie-web':['LICENSE.md'],'ffmpeg-static':['LICENSE','ffmpeg.LICENSE','ffmpeg.README']})){
  for(const name of names)await fs.copyFile(path.join('node_modules',module,name),path.join(dest,module+'-'+name.replaceAll('/','-')));
 }
 const scope=path.resolve('node_modules/@img');
 for(const name of await fs.readdir(scope)){
  if(!name.startsWith('sharp-libvips-'))continue;
  for(const file of ['README.md','versions.json'])await fs.copyFile(path.join(scope,name,file),path.join(dest,name+'-'+file));
 }
 const binary=require('ffmpeg-static');const build=execFileSync(binary,['-version'],{encoding:'utf8',windowsHide:true});
 await fs.writeFile(path.join(dest,'FFmpeg-build.txt'),build);
 console.log('Recorded platform-specific FFmpeg build and asset dependency notices.');
})().catch(e=>{console.error(e);process.exitCode=1});
