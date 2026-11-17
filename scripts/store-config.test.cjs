const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateIdentity, renderManifest } = require('./store-config.cjs');
const valid = { identityName:'12345.SampleMedia',publisher:'CN=12345678-1234-1234-1234-123456789012',publisherDisplayName:'Example & Co',displayName:'MediaConvert',supportEmail:'support@example.com',privacyPolicyUrl:'https://example.com/privacy' };
test('Store configuration rejects placeholders and missing release checks', () => {
  assert.ok(validateIdentity({...valid, publisher:'CN=REPLACE_WITH_ID'}).some(e=>e.includes('publisher')));
  assert.deepEqual(validateIdentity(valid), []);
  assert.equal(validateIdentity(valid,true).length,5);
});
test('manifest escapes publisher data and declares local conversion capability and quoted file activation', async () => {
  const xml = await renderManifest(valid,'1.2.0');
  assert.match(xml,/Version="1.2.0.0"/);
  assert.match(xml,/Example &amp; Co/);
  assert.match(xml,/runFullTrust/);
  assert.ok(!xml.includes('internetClient'));
  assert.match(xml,/--convert &quot;%1&quot;/);
  assert.ok(!xml.includes('{{'));
});

test('missing public privacy URL permits packaging but blocks final submission', () => {
  const config = {...valid, privacyPolicyUrl: 'REPLACE_WITH_PUBLIC_HTTPS_PRIVACY_POLICY_URL'};
  assert.deepEqual(validateIdentity(config), []);
  assert.ok(validateIdentity(config, true).some(error => error.includes('public HTTPS')));
});
