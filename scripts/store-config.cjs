const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function validateIdentity(config, submission = false) {
  const errors = [];
  for (const key of ['identityName', 'publisher', 'publisherDisplayName', 'displayName', 'supportEmail']) {
    if (!config[key] || /REPLACE_|PLACEHOLDER|TODO/i.test(config[key])) errors.push(`Set ${key} in store/identity.json.`);
  }
  if (config.identityName && !/^[A-Za-z0-9.-]{3,50}$/.test(config.identityName)) errors.push('identityName must be the exact 3–50 character Partner Center package name.');
  if (config.publisher && !/^CN=.+/.test(config.publisher)) errors.push('publisher must be the exact CN=… value from Partner Center.');
  if (config.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail)) errors.push('Set a valid supportEmail.');
  // A privacy URL is required by the Store listing, not by the MSIX manifest.
  // Keep it a submission check so an identity-correct package can be built first.
  if (submission && (!config.privacyPolicyUrl || /REPLACE_|PLACEHOLDER|TODO/i.test(config.privacyPolicyUrl) || !/^https:\/\//.test(config.privacyPolicyUrl))) errors.push('Host the privacy policy at a public HTTPS URL.');
  if (submission) {
    for (const key of ['windowsInstallationAndUninstallTested', 'windowsAppCertificationKitPassed', 'keyboardAndScreenReaderReviewed', 'correspondingSourceAndLicensesReviewed', 'listingAndAgeRatingsReviewed']) {
      if (config.releaseChecks?.[key] !== true) errors.push(`Complete release check: ${key}.`);
    }
  }
  return errors;
}
const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function renderManifest(config, version) {
  const template = await fs.readFile(path.join(root, 'store/AppxManifest.template.xml'), 'utf8');
  const extensions = 'mp4 mov mkv webm avi gif mp3 wav flac aac m4a ogg opus wmv flv ts 3gp wma aiff aif hevc m2ts mts mpeg mpg m4v mka oga vob'.split(' ');
  const values = { ...config, version: `${version}.0`, fileTypes: extensions.map(ext => `<uap:FileType>.${ext}</uap:FileType>`).join('') };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => key === 'fileTypes' ? values[key] : escapeXml(values[key]));
}
async function prepare(config) {
  const errors = validateIdentity(config);
  if (errors.length) throw new Error(errors.join('\n'));
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const output = path.join(root, 'dist/store-staging');
  await fs.rm(output, {recursive: true, force: true});
  await fs.mkdir(output, {recursive: true});
  await fs.cp(path.join(root, 'dist/win-unpacked'), path.join(output, 'app'), {
    recursive: true, filter: filename => !/\.(cmd|ps1)$/i.test(filename) && !/Uninstall\.exe$/i.test(filename)
  });
  await fs.cp(path.join(root, 'build/assets'), path.join(output, 'Assets'), {recursive: true});
  await fs.writeFile(path.join(output, 'AppxManifest.xml'), await renderManifest(config, pkg.version));
  return output;
}
if (require.main === module) (async () => {
  const config = JSON.parse(await fs.readFile(path.join(root, 'store/identity.json'), 'utf8'));
  const errors = validateIdentity(config, process.argv.includes('--submission'));
  if (errors.length) throw new Error(errors.join('\n'));
  if (process.argv.includes('--prepare')) console.log('MSIX staging ready:', await prepare(config));
  else console.log('Store configuration checks passed. Exact Partner Center matching must still be verified by the publisher.');
})().catch(error => {console.error(error.message);process.exitCode=1;});
module.exports = { validateIdentity, renderManifest };
