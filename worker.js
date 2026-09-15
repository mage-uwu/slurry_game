import { DurableObject } from 'cloudflare:workers';
import { showcaseFetch } from './showcase-worker.js';
export { Showcase } from './showcase-worker.js';

const COOKIE = '__Host-monomage-visitor';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noCache = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

// One durable, atomic total for every language and the game.
export class VisitorCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS totals (id INTEGER PRIMARY KEY CHECK(id = 1), total INTEGER NOT NULL)');
    this.sql.exec('INSERT OR IGNORE INTO totals (id, total) VALUES (1, 0)');
  }
  total() {
    return this.sql.exec('SELECT total FROM totals WHERE id = 1').one().total;
  }
  record(id) {
    if (!UUID.test(id)) throw new Error('Invalid visitor identifier');
    return this.ctx.storage.transactionSync(() => {
      const inserted = this.sql.exec('INSERT OR IGNORE INTO visitors (id) VALUES (?) RETURNING id', id).toArray().length;
      if (inserted) this.sql.exec('UPDATE totals SET total = total + 1 WHERE id = 1');
      return this.total();
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/showcase' || url.pathname.startsWith('/api/showcase/')) return showcaseFetch(request, env);
    if (url.pathname !== '/api/visitors') return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { ...noCache, Allow: 'GET, POST' } });
    }
    const origin = request.headers.get('Origin');
    if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return new Response(null, { status: 403, headers: noCache });
    }
    try {
      const counter = env.VISITORS.getByName('monomage-total-v1');
      if (request.method === 'GET' || request.cf?.botManagement?.verifiedBot) {
        return Response.json({ total: await counter.total() }, { headers: noCache });
      }
      // A small JSON body provides retry-safe identity even before the first cookie returns.
      if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) {
        return new Response(null, { status: 415, headers: noCache });
      }
      const reader = request.body?.getReader();
      let body = '', size = 0;
      if (reader) {
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 256) { await reader.cancel(); return new Response(null, { status: 413, headers: noCache }); }
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      }
      let data;
      try { data = JSON.parse(body || '{}'); } catch { return new Response(null, { status: 400, headers: noCache }); }
      if (!data || typeof data !== 'object' || Array.isArray(data) || (data.id !== undefined && !UUID.test(data.id))) {
        return new Response(null, { status: 400, headers: noCache });
      }
      const cookie = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='));
      const saved = cookie?.slice(COOKIE.length + 1);
      const id = saved && UUID.test(saved) ? saved : data.id || crypto.randomUUID();
      const total = await counter.record(id);
      return Response.json({ total }, {
        headers: { ...noCache, 'Set-Cookie': COOKIE + '=' + id + '; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax' },
      });
    } catch {
      // Counter availability must never prevent the static site or game from loading.
      return Response.json({ error: 'unavailable' }, { status: 503, headers: noCache });
    }
  },
};
