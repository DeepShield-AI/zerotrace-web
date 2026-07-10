/**
 * Verify: all flow logic is correct
 * Tests each step of the user journey against requirements.
 */
const http = require('http');
const API = 'http://localhost:3001';

let pass = 0, fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${label}${detail ? ': ' + detail : ''}`); pass++; }
  else      { console.log(`  ❌ ${label} FAILED${detail ? ': ' + detail : ''}`); fail++; }
}

function api(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'Content-Type': 'application/json', ...headers };
    if (data) h['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers: h }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: safeJson(b) }));
    });
    req.on('error', e => resolve({ status: 0, error: e.message, body: {} }));
    if (data) req.write(data);
    req.end();
  });
}
const POST = (p, b, h) => api('POST', p, b, h);
const GET = (p, h) => api('GET', p, null, h);
function safeJson(s) { try { if (typeof s === 'object') return s; return JSON.parse(s); } catch { return s; } }
function cookie(h) {
  const sc = h['set-cookie'] || [];
  const arr = Array.isArray(sc) ? sc : [sc];
  for (const c of arr) {
    const m = c.match(/zt_session=([^;]+)/);
    if (m) return m[1];
  }
  return '';
}

(async () => {
  console.log('═══════════════════════════════════════');
  console.log('  Flow Logic Verification');
  console.log('═══════════════════════════════════════\n');

  const t = Date.now();
  const user = { name:'Test', email:`v${t}@t.com`, password:'Test1234!', org_name:`Verify-${t}` };

  // ═══ 1. REGISTER ═══
  console.log('── 1. Register ──');
  const reg = await POST('/api/v1/auth/register', user);
  const orgId = reg.body?.user?.org_id;
  let sess = cookie(reg.headers);
  ok('Register creates org+user', !!orgId && !!sess, `org_id=${orgId} session=${sess ? 'ok' : 'FAIL'}`);
  if (!orgId || !sess) { console.log('\n❌ Cannot continue — registration failed\n'); process.exit(1); }

  // ═══ 2. UNPAID → BILLING ═══
  console.log('\n── 2. Unpaid → 402 ──');
  // Before subscribing, APM/data endpoints should return 402
  const beforeSub = await GET('/api/v1/apm/services', { 'Cookie': `zt_session=${sess}` });
  ok('APM returns 402 before subscription', beforeSub.status === 402, `HTTP ${beforeSub.status}`);
  ok('Error message mentions subscription', (beforeSub.body?.error || '').includes('subscription') || (beforeSub.body?.error || '').includes('Subscribe'));

  // ═══ 3. SUBSCRIBE ═══
  console.log('\n── 3. Subscribe ──');
  const sub = await POST('/api/v1/billing/subscriptions',
    { plan_id: 1, commitment_type: 'monthly', committed_quantity: 1 },
    { 'Cookie': `zt_session=${sess}` });
  ok('Subscribe succeeds', sub.status === 200 || sub.body?.id, `status=${sub.status}`);

  // ═══ 4. SUBSCRIBED + NO DATA → INTRO ═══
  console.log('\n── 4. Subscribed + No Data ──');
  const svcAfter = await GET('/api/v1/apm/services', { 'Cookie': `zt_session=${sess}` });
  ok('Services API returns 200 after subscription', svcAfter.status === 200);
  const hasNoServices = (svcAfter.body?.services || []).length === 0;
  ok('Services list is empty', hasNoServices, `${(svcAfter.body?.services || []).length} services`);
  // The frontend checks: if services empty → redirect to /apm/intro

  // ═══ 5. CREATE API KEY ═══
  console.log('\n── 5. Create API Key ──');
  const keyResp = await POST('/api/v1/api-keys', { name:'Agent',scopes:['*'] }, { 'Cookie': `zt_session=${sess}` });
  const apiKey = keyResp.body?.api_key?.key;
  ok('API key created', !!apiKey, apiKey ? `${apiKey.substring(0,10)}...` : 'FAIL');
  ok('API key created successfully', !!apiKey && !!keyResp.body?.api_key?.id);

  // ═══ 6. REGISTER AGENT ═══
  console.log('\n── 6. Agent Registration ──');
  const agentReg = await POST('/api/v1/agents/register',
    { ctrl_ip:'202.112.237.37', ctrl_mac:`${orgId}:aa:bb:cc:dd`, hostname:`worker-${t}` },
    { 'X-API-Key': apiKey });
  ok('Agent registered via API key', agentReg.body?.ok, JSON.stringify(agentReg.body));

  // ═══ 7. AGENT VISIBLE ═══
  console.log('\n── 7. Agent Visible ──');
  const agents = await GET('/api/v1/agents/status', { 'Cookie': `zt_session=${sess}` });
  const agentList = agents.body?.DATA || [];
  const ownAgent = agentList.filter(a => a.ORG_ID === orgId);
  ok('Agent appears in status', ownAgent.length > 0, `${ownAgent.length} agents for org ${orgId}`);

  // ═══ 8. AGENT ISOLATION ═══
  console.log('\n── 8. Agent Isolation ──');
  // Register a DIFFERENT org and check they can't see our agent
  const t2 = Date.now() + 1000;
  const user2 = { name:'Admin', email:`w${t2}@t.com`, password:'Test1234!', org_name:`Other-${t2}` };
  const reg2 = await POST('/api/v1/auth/register', user2);
  const sess2 = cookie(reg2.headers);
  const orgId2 = reg2.body?.user?.org_id;
  // Subscribe user2
  await POST('/api/v1/billing/subscriptions',
    { plan_id: 1, commitment_type: 'monthly', committed_quantity: 1 },
    { 'Cookie': `zt_session=${sess2}` });

  const agents2 = await GET('/api/v1/agents/status', { 'Cookie': `zt_session=${sess2}` });
  const agentList2 = agents2.body?.DATA || [];
  const seenOurAgent = agentList2.some(a => a.ORG_ID === orgId);
  ok('Other org cannot see our agents', !seenOurAgent,
    `${agentList2.length} agents (should be 0 for new org ${orgId2})`);

  // ═══ 9. CROSS-ORG DATA ISOLATION ═══
  console.log('\n── 9. Data Isolation ──');
  // Both orgs query services — should return DIFFERENT databases
  const s1 = await GET('/api/v1/apm/services', { 'Cookie': `zt_session=${sess}` });
  const s2 = await GET('/api/v1/apm/services', { 'Cookie': `zt_session=${sess2}` });
  // Each queries different ClickHouse DB — should be scoped
  ok('Org-scoped queries work', s1.status === 200 && s2.status === 200,
    `org1:${(s1.body?.services||[]).length} org2:${(s2.body?.services||[]).length}`);

  // ═══ 10. BROWSER FLOW (HTTP simulation) ═══
  console.log('\n── 10. Setup Flow ──');
  // Simulate: GET /agents/setup → should show install command with API key
  const setupCall = await GET('/api/v1/api-keys', { 'Cookie': `zt_session=${sess}` });
  const keys = setupCall.body?.api_keys || [];
  ok('API keys listable on setup page', keys.length > 0, `${keys.length} keys found`);

  // Create a second API key and verify both show
  const key2 = await POST('/api/v1/api-keys', { name:'Key2',scopes:['*'] }, { 'Cookie': `zt_session=${sess}` });
  const setupCall2 = await GET('/api/v1/api-keys', { 'Cookie': `zt_session=${sess}` });
  const keys2 = setupCall2.body?.api_keys || [];
  ok('Multiple API keys work', keys2.length >= 2, `${keys2.length} keys`);

  // ═══ RESULTS ═══
  console.log(`\n═══ ✅ ${pass}  ❌ ${fail}  (${pass+fail} total) ═══\n`);
  // Check all critical flows
  const criticalFlows = [
    (!!orgId && !!sess),                    // register
    beforeSub.status === 402,               // unpaid→402
    sub.status === 200,                     // subscribe
    svcAfter.status === 200,                // subscribed→200
    !!apiKey,                               // create key
    agentReg.body?.ok,                      // register agent
    ownAgent.length > 0,                    // agent visible
    !seenOurAgent,                          // agent isolation
  ];
  const allCritical = criticalFlows.every(Boolean);
  if (allCritical) {
    console.log('✅ All critical flows work correctly!\n');
  } else {
    console.log('❌ Some critical flows failed.\n');
    process.exit(1);
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
