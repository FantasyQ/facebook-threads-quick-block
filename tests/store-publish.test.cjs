const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publish } = require('../scripts/store-publish.cjs');
const itemId = 'cjjbobacehmaoflfllilepgjkkhmiifi';
const env = { CWS_UNLISTED_READY: 'true', CWS_PUBLISHER_ID: 'publisher-test', CWS_CLIENT_ID: 'test', CWS_CLIENT_SECRET: 'secret', CWS_REFRESH_TOKEN: 'refresh' };
function fixture(overrides = {}) {
  const calls = [];
  const status = { itemId, publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.4.4' }] }, ...overrides };
  const responses = [{ access_token: 'access' }, status, { itemId, uploadState: 'SUCCEEDED', crxVersion: '0.4.5' }, { itemId, state: 'PENDING_REVIEW' }];
  const request = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => responses.shift() }; };
  return { calls, responses, args: { env, request, sleep: async () => {}, zip: Buffer.from('mock zip'), version: '0.4.5' } };
}
test('store submits exact package with review and warnings enabled, using fixed endpoints', async () => {
  const f = fixture();
  assert.equal(await publish(f.args), 'PENDING_REVIEW');
  assert.equal(f.calls.length, 4);
  assert.equal(f.calls[2].options.body, f.args.zip);
  assert.deepEqual(JSON.parse(f.calls[3].options.body), { publishType: 'DEFAULT_PUBLISH', skipReview: false, blockOnWarnings: true });
  assert.ok(f.calls[2].url.endsWith(`/items/${itemId}:upload`));
  assert.ok(f.calls.every(c => c.options.redirect === 'error'));
});
test('store refuses testers-only, unpublished, pending, warned and non-increasing versions before upload', async () => {
  for (const changes of [
    { publishedItemRevisionStatus: { state: 'PUBLISHED_TO_TESTERS' } },
    { publishedItemRevisionStatus: undefined },
    { submittedItemRevisionStatus: { state: 'PENDING_REVIEW' } },
    { warned: true },
    { publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.4.5' }] } },
  ]) {
    const f = fixture(changes);
    await assert.rejects(publish(f.args));
    assert.equal(f.calls.length, 2);
  }
});
test('store disabled configuration makes no requests', async () => {
  const f = fixture(); f.args.env = { ...env, CWS_UNLISTED_READY: 'false' };
  await assert.rejects(publish(f.args)); assert.equal(f.calls.length, 0);
});
test('failed upload never sends publish; async upload is polled to completion', async () => {
  const failed = fixture(); failed.responses[2].uploadState = 'FAILED';
  await assert.rejects(publish(failed.args)); assert.equal(failed.calls.length, 3);
  const f = fixture(); f.responses[2].uploadState = 'IN_PROGRESS';
  f.responses.splice(3, 0, { itemId, lastAsyncUploadState: 'SUCCEEDED' });
  assert.equal(await publish(f.args), 'PENDING_REVIEW'); assert.equal(f.calls.length, 5);
});
test('HTTP failure redacts response body and does not retry mutations', async () => {
  const f = fixture(); let calls = 0;
  const original = f.args.request;
  f.args.request = async (...args) => ++calls === 3 ? { ok: false, status: 403, json: async () => ({ secret: 'do-not-log' }) } : original(...args);
  await assert.rejects(publish(f.args), error => !error.message.includes('do-not-log') && error.message.includes('403'));
  assert.equal(calls, 3);
});
test('connection check refreshes credentials and reads status without uploading or publishing', async () => {
  const f = fixture({ publishedItemRevisionStatus: undefined });
  const result = await publish({ ...f.args, env: { ...env, CWS_UNLISTED_READY: 'false' }, checkOnly: true });
  assert.equal(f.calls.length, 2);
  assert.deepEqual(result, { credentialsValid: true, shortLivedRefreshToken: false, publishedState: 'NOT_PUBLISHED', submittedState: 'NONE', visibilityVerified: false });
  assert.ok(!JSON.stringify(result).includes('access'));
});
test('short-lived test-mode refresh token is reported by check and prevents upload', async () => {
  const f = fixture(); f.responses[0].refresh_token_expires_in = 604799;
  const result = await publish({ ...f.args, checkOnly: true });
  assert.equal(result.shortLivedRefreshToken, true); assert.equal(f.calls.length, 2);
  const p = fixture(); p.responses[0].refresh_token_expires_in = 604799;
  await assert.rejects(publish(p.args), /seven days/); assert.equal(p.calls.length, 2);
});
