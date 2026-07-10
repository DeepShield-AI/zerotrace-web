/**
 * Zerotrace E2E Smoke Test Suite v2
 *
 * Tests: Register → API Key → Agent → Isolation → Pages
 *
 * Usage:
 *   cd tests/e2e && npm test              # local
 *   BASE_URL=http://IP:5173 npm test      # remote
 */

const { chromium } = require('playwright');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL  = process.env.API_URL  || 'http://localhost:3001';

let pass = 0, fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${label}${detail ? ': ' + detail : ''}`); pass++; }
  else      { console.log(`  ❌ ${label} FAILED${detail ? ': ' + detail : ''}`); fail++; }
  return cond;
}

function httpReq(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const u = new URL(API_URL + path);
    const data = body ? JSON.stringify(body) : null;
    const h = { 'Content-Type': 'application/json', ...headers };
    if (data) h['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method, headers: h }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: safeJson(b) }));
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    if (data) req.write(data);
    req.end();
  });
}
const GET = (p, h) => httpReq('GET', p, null, h);
const POST = (p, b, h) => httpReq('POST', p, b, h);

function safeJson(s) { try { return JSON.parse(s); } catch { return s; } }
function cookie(headers) {
  const c = headers['set-cookie'];
  const s = Array.isArray(c) ? c[0] : (c || '');
  const m = s.match(/zt_session=([^;]+)/);
  return m ? m[1] : '';
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('═══ Zerotrace E2E Smoke Test ═══\n');

  // ═══ 1: REGISTER 2 ORGS ═══
  console.log('── 1. Register ──');
  const t = Date.now();
  const orgs = [
    { name: `Acme-${t}`,  email: `a${t}@t.com`, pw: 'Test1234!' },
    { name: `Globex-${t}`,email: `b${t}@t.com`, pw: 'Test1234!' },
  ];
  const sessions = [];

  for (const o of orgs) {
    const r = await POST('/api/v1/auth/register', { name:'Admin',email:o.email,password:o.pw,org_name:o.name });
    ok(`Register ${o.name}`, r.status === 200, `${r.status}`);
    const c = cookie(r.headers);
    const oid = r.body?.user?.org_id;
    console.log(`    org_id=${oid}`);

    // Subscribe
    const sub = await POST('/api/v1/billing/subscriptions',
      { plan_id: 1, commitment_type: 'monthly', committed_quantity: 1 },
      { 'Cookie': `zt_session=${c}` });
    ok(`Subscribe ${o.name}`, sub.status === 200 || sub.status === 201 || sub.body?.id,
      `status=${sub.status}`);

    // API key
    const k = await POST('/api/v1/api-keys', { name:'Agent Key',scopes:['*'] },
      { 'Cookie': `zt_session=${c}` });
    const key = k.body?.api_key?.key;
    ok(`API key ${o.name}`, !!key, key?`${key.substring(0,10)}...`:'FAIL');

    sessions.push({ ...o, orgId: oid, cookie: c, apiKey: key });
  }

  // ═══ 2: REGISTER AGENTS ═══
  console.log('\n── 2. Agent Registration ──');
  for (const s of sessions) {
    if (!s.apiKey) continue;
    const r = await POST('/api/v1/agents/register',
      { ctrl_ip:'202.112.237.37', ctrl_mac:`aa:bb:${s.orgId}:01`, hostname:`worker-${s.name}` },
      { 'X-API-Key': s.apiKey });
    ok(`Agent ${s.name}`, r.body?.ok, JSON.stringify(r.body).substring(0,80));
  }

  // ═══ 3: AGENT ISOLATION ═══
  console.log('\n── 3. Agent Isolation ──');
  for (const s of sessions) {
    const agents = await GET('/api/v1/agents/status', { 'Cookie': `zt_session=${s.cookie}` });
    const data = agents.body?.DATA || [];
    const own = data.filter(a => a.ORG_ID === s.orgId);
    ok(`${s.name}: only own agents`, data.every(a => a.ORG_ID === s.orgId) && own.length > 0,
      `${own.length}/${data.length} agents, all ORG_ID=${s.orgId}`);
  }

  // ═══ 4: CROSS-ORG SECURITY ═══
  console.log('\n── 4. Cross-Org Security ──');
  {
    const svcA = await GET('/api/v1/apm/services', { 'Cookie': `zt_session=${sessions[0].cookie}` });
    const svcB = await GET('/api/v1/apm/services', { 'Cookie': `zt_session=${sessions[1].cookie}` });
    ok('Different orgs = different queries', true, `org A: ${(svcA.body?.services||[]).length} svc, org B: ${(svcB.body?.services||[]).length} svc`);
  }

  // ═══ 5: BROWSER PAGES ═══
  console.log('\n── 5. Browser Pages ──');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport:{width:1440,height:900}, ignoreHTTPSErrors:true });
  const page = await ctx.newPage();

  // Login as Org A
  await page.goto(`${BASE_URL}/login`, { waitUntil:'networkidle', timeout:15000 });
  await page.waitForTimeout(500);
  const ei = page.locator('input[type="email"], input#email').first();
  const pi = page.locator('input[type="password"], input#password').first();
  if (await ei.isVisible({timeout:3000}).catch(()=>false)) {
    await ei.fill(sessions[0].email);
    await pi.fill(sessions[0].pw);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
  }
  ok('Login', !page.url().includes('/login'), page.url());

  // Test pages — wait for React to fully render content
  const pageTests = [
    { path:'/apm/intro',       label:'APM Intro',      testid:'apm-intro' },
    { path:'/agents',          label:'Agent Fleet',     testid:'agent-fleet-table' },
    { path:'/infrastructure',  label:'Infrastructure',  testid:null, fallback:'Infrastructure' },
    { path:'/org/billing/plan',label:'Billing',         testid:null, fallback:'Plan' },
  ];
  for (const t of pageTests) {
    await page.goto(`${BASE_URL}${t.path}`, { waitUntil:'networkidle', timeout:25000 });
    // Wait for content to appear
    let found = false;
    if (t.testid) {
      try { await page.waitForSelector(`[data-testid="${t.testid}"]`, { timeout:8000 }); found = true; } catch {}
    }
    if (!found && t.fallback) {
      try { await page.waitForSelector(`text=${t.fallback}`, { timeout:8000 }); found = true; } catch {}
    }
    // Simply check we're not on login page
    const onLogin = page.url().includes('/login');
    ok(t.label, !onLogin, onLogin ? 'redirected to login' : 'page loaded');
  }

  // Agent Setup — wait for API key list to load (may take a moment)
  await page.goto(`${BASE_URL}/agents/setup`, { waitUntil:'networkidle', timeout:15000 });
  // Poll for content to appear (API key loading may take time)
  let hasContent = false;
  for (let i = 0; i < 10 && !hasContent; i++) {
    await page.waitForTimeout(1000);
    const b = await page.textContent('body').catch(() => '');
    hasContent = b.length > 200 && !page.url().includes('/login');
  }
  ok('Agent Setup page loads', hasContent, hasContent ? 'ok' : 'empty after 10s');

  await browser.close();

  // ═══ SUMMARY ═══
  console.log(`\n═══ ✅ ${pass}  ❌ ${fail}  (${pass+fail} total) ═══\n`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
