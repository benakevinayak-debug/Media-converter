// Make the standalone installer using native NSIS; no Wine or signing certificate is required.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
(async () => {
  const root = path.resolve(__dirname,'..');
  const appDir = path.join(root,'dist/win-unpacked');
  const pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  await fs.access(path.join(appDir,'MediaConvert.exe'));
  const files=[],directories=[];
  async function walk(folder){for(const item of await fs.readdir(folder,{withFileTypes:true})){const filename=path.join(folder,item.name);if(item.isDirectory()){directories.push(filename);await walk(filename)}else files.push(filename)}}
  await walk(appDir);
  const nsisEscape = value => value.replace(/\$/g,'$$').replace(/"/g,'$\\"');
  const relative = filename => nsisEscape(path.relative(appDir,filename).split(path.sep).join('\\'));
  // Remove only shipped files on uninstall; preserve unrelated files added by the user.
  const uninstall = files.map(filename=>`Delete "$INSTDIR\\${relative(filename)}"`).concat(directories.sort((a,b)=>b.length-a.length).map(folder=>`RMDir "$INSTDIR\\${relative(folder)}"`));
  const uninstallList = path.join(root,'dist/uninstall-files.nsh');
  await fs.writeFile(uninstallList,uninstall.join('\n')+'\n');
  const output = path.join(root,`dist/MediaConvert-Setup-${pkg.version}-x64.exe`);
  const prefix = process.platform==='win32'?'/':'-';
  const defines = {APP_DIR:appDir,PROJECT_DIR:root,ICON_PATH:path.join(root,'build/icon.ico'),APP_VERSION:pkg.version,OUTPUT_PATH:output,UNINSTALL_LIST:uninstallList};
  const args=[`${prefix}V2`,...Object.entries(defines).map(([key,value])=>`${prefix}D${key}=${value}`),path.join(root,'desktop/setup.nsi')];
  const compiler=process.env.NSIS_PATH||(process.platform==='win32'?'C:\\Program Files (x86)\\NSIS\\makensis.exe':'makensis');
  const result=spawnSync(compiler,args,{stdio:'inherit',cwd:root});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`NSIS compiler exited ${result.status}`);
  console.log('Created unsigned setup:',output);
})().catch(error=>{console.error(error.message);process.exitCode=1});
