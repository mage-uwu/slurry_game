const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const { Miniflare } = require('miniflare');
(async () => {
  const root = path.resolve(__dirname, '..');
  const state = await mkdtemp(path.join(os.tmpdir(), 'monomage-count-'));
  const create = () => new Miniflare({
    name: 'slurry-game', modules: true, scriptPath: path.join(root, 'worker.js'),
    compatibilityDate: '2025-09-01',
    modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
    durableObjects: { VISITORS: { className: 'VisitorCounter', useSQLite: true } },
    durableObjectsPersist: state,
    serviceBindings: { ASSETS: () => new Response('static site', { status: 200 }) },
  });
  let mf = create();
  const endpoint = 'https://monomage.test/api/visitors';
  const request = (init = {}) => mf.dispatchFetch(endpoint, init);
  const visit = (id, extra = {}) => request({
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://monomage.test', ...extra },
    body: JSON.stringify(id ? { id } : {}),
  });
  try {
    assert.equal((await (await request()).json()).total, 0);
    const id = crypto.randomUUID();
    const first = await visit(id), cookie = first.headers.get('Set-Cookie').split(';')[0];
    assert.equal((await first.json()).total, 1);
    assert.equal(first.headers.get('Cache-Control'), 'no-store');
    for (let i = 0; i < 5; i++) assert.equal((await (await visit(id)).json()).total, 1);
    // Repeated simultaneous requests with one ID must count only once.
    const next = crypto.randomUUID();
    await Promise.all(Array.from({ length: 20 }, () => visit(next)));
    assert.equal((await (await request()).json()).total, 2);
    // Independent browsers have one shared total; concurrent increments cannot get lost.
    await Promise.all(Array.from({ length: 20 }, () => visit(crypto.randomUUID())));
    assert.equal((await (await request()).json()).total, 22);
    // The cookie prevents counting the browser again if its local storage was cleared.
    assert.equal((await (await visit(crypto.randomUUID(), { Cookie: cookie })).json()).total, 22);
    assert.equal((await visit(id, { Origin: 'https://other.test' })).status, 403);
    assert.equal((await request({ method: 'DELETE' })).status, 405);
    assert.equal((await request({ method: 'POST', body: 'x' })).status, 415);
    assert.equal((await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    assert.equal((await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(300) })).status, 413);
    assert.equal((await visit('not-an-id')).status, 400);
    assert.equal(await (await mf.dispatchFetch('https://monomage.test/slurry/')).text(), 'static site');
    await mf.dispose(); mf = create();
    assert.equal((await (await request()).json()).total, 22);
    assert.equal((await (await visit(id)).json()).total, 22);
    console.log('PASS persistent shared total, browser deduplication, concurrent increments, validation and asset fallback');
  } finally {
    await mf.dispose(); await rm(state, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
