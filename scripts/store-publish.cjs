const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const ITEM = 'cjjbobacehmaoflfllilepgjkkhmiifi';
async function publish({ env = process.env, request = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), zip, version, checkOnly = false }) {
  for (const key of ['CWS_PUBLISHER_ID', 'CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN']) {
    if (!env[key]) throw Error(`Missing ${key}`);
  }
  if (!checkOnly && env.CWS_UNLISTED_READY !== 'true') throw Error('Unlisted first publication must be confirmed before enabling automation');
  if (!/^[a-zA-Z0-9-]+$/.test(env.CWS_PUBLISHER_ID)) throw Error('Invalid publisher ID');
  async function json(url, options = {}) {
    let response;
    try { response = await request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(60000) }); }
    catch { throw Error('Store request failed or timed out; inspect dashboard before retrying'); }
    if (!response.ok) {
      const stage = url === 'https://oauth2.googleapis.com/token' ? 'OAuth token request' : 'Store request';
      let detail = '';
      // Only log known error identifiers, never Google's raw response or request values.
      if (stage === 'OAuth token request') {
        try {
          const body = await response.json();
          if (['invalid_client', 'invalid_grant', 'unauthorized_client', 'invalid_request'].includes(body.error)) detail = `: ${body.error}`;
        } catch {}
      }
      throw Error(`${stage} failed (HTTP ${response.status}${detail}); inspect credentials or dashboard before retrying`);
    }
    try { return await response.json(); } catch { throw Error('Invalid store response'); }
  }
  const auth = await json('https://oauth2.googleapis.com/token', {
    method: 'POST', body: new URLSearchParams({ client_id: env.CWS_CLIENT_ID, client_secret: env.CWS_CLIENT_SECRET,
      refresh_token: env.CWS_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  if (typeof auth.access_token !== 'string' || !auth.access_token) throw Error('No access token returned');
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const name = `publishers/${env.CWS_PUBLISHER_ID}/items/${ITEM}`;
  const base = `https://chromewebstore.googleapis.com/v2/${name}`;
  const status = await json(`${base}:fetchStatus`, { headers });
  if (status.itemId !== ITEM || status.warned || status.takenDown) throw Error('Item mismatch or store policy warning');
  const shortLived = Number.isFinite(auth.refresh_token_expires_in) && auth.refresh_token_expires_in <= 7 * 86400;
  if (checkOnly) return {
    credentialsValid: true,
    shortLivedRefreshToken: shortLived,
    publishedState: status.publishedItemRevisionStatus?.state || 'NOT_PUBLISHED',
    submittedState: status.submittedItemRevisionStatus?.state || 'NONE',
    // The API does not distinguish Public and Unlisted; confirm in dashboard.
    visibilityVerified: false,
  };
  if (shortLived) throw Error('Refresh token expires within seven days; authorize again after switching OAuth to production');
  if (status.publishedItemRevisionStatus?.state !== 'PUBLISHED') throw Error('Existing item must be published; verify Unlisted visibility in the dashboard');
  if (status.submittedItemRevisionStatus && !['REJECTED', 'CANCELLED', 'PUBLISHED'].includes(status.submittedItemRevisionStatus.state)) throw Error('An existing submission needs attention in the dashboard');
  const versions = status.publishedItemRevisionStatus.distributionChannels?.map(c => c.crxVersion) || [];
  const newer = old => {
    if (!/^\d+(\.\d+){0,3}$/.test(old)) return false;
    const a = version.split('.').map(Number), b = old.split('.').map(Number);
    for (let i = 0; i < 4; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
    return false;
  };
  if (!versions.length || !versions.every(newer)) throw Error('New version must exceed all published versions');
  const upload = await json(`https://chromewebstore.googleapis.com/upload/v2/${name}:upload`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: zip,
  });
  if (upload.itemId !== ITEM) throw Error('Upload item mismatch');
  let state = upload.uploadState;
  for (let i = 0; i < 24 && ['IN_PROGRESS', 'UPLOAD_IN_PROGRESS'].includes(state); i++) {
    await sleep(5000);
    const current = await json(`${base}:fetchStatus`, { headers });
    if (current.itemId !== ITEM) throw Error('Status item mismatch');
    state = current.lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED' || (upload.crxVersion && upload.crxVersion !== version)) throw Error('Upload not confirmed; no publish request sent');
  const result = await json(`${base}:publish`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH', skipReview: false, blockOnWarnings: true }),
  });
  if (result.itemId !== ITEM || !['PENDING_REVIEW', 'PUBLISHED'].includes(result.state)) throw Error('Unexpected submission state; inspect dashboard');
  return result.state;
}
async function main() {
  if (process.argv.includes('--check')) {
    const result = await publish({ checkOnly: true });
    console.log(JSON.stringify(result, null, 2));
    if (result.shortLivedRefreshToken) throw Error('Short-lived refresh token: update CWS_REFRESH_TOKEN after production authorization');
    return;
  }
  const version = require('../extension/manifest.json').version;
  if (process.env.RELEASE_TAG !== `v${version}`) throw Error('Release tag must match manifest');
  const file = `facebook-threads-quick-block-${version}.zip`;
  const zip = fs.readFileSync(path.join(root, 'dist', file));
  const checksum = fs.readFileSync(path.join(root, 'dist', `${file}.sha256`), 'utf8').trim();
  if (checksum !== `${createHash('sha256').update(zip).digest('hex')}  ${file}`) throw Error('ZIP checksum mismatch');
  const state = await publish({ zip, version });
  console.log(`Chrome Web Store: ${state}. Submission acceptance does not imply review approval.`);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { publish };
