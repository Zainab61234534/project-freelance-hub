import 'dotenv/config';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CATEGORY_ID = process.env.CATEGORY_ID ?? 'a2fa1609-ed21-4581-8117-6b84d605877f';

const stamp = Date.now();
const freelancerEmail = `freelancer.${stamp}@example.com`;
const clientEmail = `client.${stamp}@example.com`;
const client2Email = `client2.${stamp}@example.com`;
const password = 'Password123!';

const results = [];
let pass = 0;
let fail = 0;

function cookieFrom(res) {
  const all = res.headers.getSetCookie?.() ?? [];
  for (const c of all) {
    if (c.startsWith('fh_session=')) return c.split(';')[0];
  }
  return null;
}

async function call(method, path, { body, cookie, form } = {}) {
  const headers = {};
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  return { status: res.status, json, text, cookie: cookieFrom(res) };
}

function check(name, got, expected, extra = '') {
  const ok = Array.isArray(expected) ? expected.includes(got) : got === expected;
  if (ok) pass++; else fail++;
  results.push(`${ok ? 'PASS' : 'FAIL'} | ${String(got).padEnd(3)} expected ${expected} | ${name}${extra ? ' | ' + extra : ''}`);
  return ok;
}

const json = (r) => (r.json ? JSON.stringify(r.json) : r.text).slice(0, 220);

// ---------- AUTH ----------
let r = await call('POST', '/auth/register', { body: { name: 'Smoke Freelancer', email: freelancerEmail, password, role: 'FREELANCER' } });
check('register freelancer', r.status, 201, json(r));

r = await call('POST', '/auth/register', { body: { name: 'Smoke Client', email: clientEmail, password, role: 'CLIENT' } });
check('register client', r.status, 201, json(r));

r = await call('POST', '/auth/register', { body: { name: 'Smoke Client 2', email: client2Email, password, role: 'CLIENT' } });
check('register second client', r.status, 201, json(r));

r = await call('POST', '/auth/register', { body: { name: 'Dup', email: freelancerEmail, password, role: 'FREELANCER' } });
check('register duplicate email', r.status, 409, json(r));

r = await call('POST', '/auth/register', { body: { name: 'Admin', email: `admin.${stamp}@example.com`, password, role: 'ADMIN' } });
check('register invalid role', r.status, 400, json(r));

r = await call('POST', '/auth/register', { body: { name: '', email: 'bad', password: 'short', role: 'FREELANCER' } });
check('register invalid payload', r.status, 400, json(r));

r = await call('POST', '/auth/login', { body: { email: freelancerEmail, password } });
const freelancerCookie = r.cookie;
check('login freelancer', r.status, 200, json(r));
check('login sets fh_session cookie', freelancerCookie ? 200 : 0, 200);

r = await call('POST', '/auth/login', { body: { email: freelancerEmail, password: 'WrongPassword123' } });
check('login wrong password', r.status, 401, json(r));

r = await call('POST', '/auth/login', { body: { email: clientEmail, password } });
const clientCookie = r.cookie;
check('login client', r.status, 200, json(r));

r = await call('POST', '/auth/login', { body: { email: client2Email, password } });
const client2Cookie = r.cookie;
check('login second client', r.status, 200, json(r));

r = await call('GET', '/auth/me', { cookie: freelancerCookie });
check('auth/me authenticated', r.status, 200, json(r));

r = await call('GET', '/auth/me');
check('auth/me no session', r.status, 401, json(r));

r = await call('GET', '/auth/me', { cookie: 'fh_session=invalid-token' });
check('auth/me invalid session', r.status, 401, json(r));

// ---------- FREELANCER PROFILE ----------
let form = new FormData();
form.append('bio', 'NestJS developer');
form.append('hourlyRate', '25.50');
r = await call('POST', '/freelancer-profile', { form, cookie: freelancerCookie });
check('profile create', r.status, 201, json(r));

form = new FormData();
form.append('bio', 'Duplicate');
form.append('hourlyRate', '30');
r = await call('POST', '/freelancer-profile', { form, cookie: freelancerCookie });
check('profile create duplicate', r.status, 409, json(r));

r = await call('GET', '/freelancer-profile/me', { cookie: freelancerCookie });
check('profile get me', r.status, 200, json(r));

form = new FormData();
form.append('bio', 'Updated bio');
form.append('hourlyRate', '35');
r = await call('PATCH', '/freelancer-profile/me', { form, cookie: freelancerCookie });
check('profile update', r.status, 200, json(r));

form = new FormData();
form.append('bio', 'Client profile');
form.append('hourlyRate', '10');
r = await call('POST', '/freelancer-profile', { form, cookie: clientCookie });
check('profile create as client', r.status, 403, json(r));

r = await call('GET', '/freelancer-profile/me', { cookie: clientCookie });
check('profile get me as client (no profile)', r.status, 404, json(r));

r = await call('GET', '/freelancer-profile/me');
check('profile get me no session', r.status, 401, json(r));

form = new FormData();
form.append('hourlyRate', '0');
r = await call('PATCH', '/freelancer-profile/me', { form, cookie: freelancerCookie });
check('profile invalid hourlyRate', r.status, 400, json(r));

// ---------- PROJECTS ----------
let projectBody = { title: 'Smoke Project', description: 'A project created by smoke test', budget: 500.5, categoryId: CATEGORY_ID };
r = await call('POST', '/projects', { body: projectBody, cookie: clientCookie });
const projectId = r.json?.id;
check('project create (client)', r.status, 201, json(r));
check('project create returns id', projectId ? 201 : 0, 201);

r = await call('POST', '/projects', { body: projectBody, cookie: freelancerCookie });
check('project create as freelancer', r.status, 403, json(r));

r = await call('POST', '/projects', { body: projectBody });
check('project create no session', r.status, 401, json(r));

r = await call('POST', '/projects', { body: { ...projectBody, categoryId: '123e4567-e89b-42d3-a456-426614174000' }, cookie: clientCookie });
check('project create unknown category', r.status, 404, json(r));

r = await call('POST', '/projects', { body: { ...projectBody, categoryId: 'not-a-uuid' }, cookie: clientCookie });
check('project create invalid category uuid', r.status, 400, json(r));

r = await call('POST', '/projects', { body: { ...projectBody, budget: 0 }, cookie: clientCookie });
check('project create invalid budget', r.status, 400, json(r));

r = await call('GET', '/projects', { cookie: clientCookie });
check('projects list', r.status, 200, json(r));
check('projects list pagination shape', r.json?.pagination ? 200 : 0, 200);

r = await call('GET', '/projects?search=Smoke', { cookie: clientCookie });
check('projects list search', r.status, 200, json(r));

r = await call('GET', `/projects?categoryId=${CATEGORY_ID}`, { cookie: clientCookie });
check('projects list filter by category', r.status, 200, json(r));

r = await call('GET', '/projects?sortBy=budget_asc', { cookie: clientCookie });
check('projects list sort budget_asc', r.status, 200, json(r));

r = await call('GET', '/projects?sortBy=budget_desc', { cookie: clientCookie });
check('projects list sort budget_desc', r.status, 200, json(r));

r = await call('GET', '/projects?sortBy=wrong', { cookie: clientCookie });
check('projects list invalid sortBy', r.status, 400, json(r));

r = await call('GET', '/projects?page=0&limit=51', { cookie: clientCookie });
check('projects list invalid page/limit', r.status, 400, json(r));

r = await call('GET', `/projects/${projectId}`, { cookie: clientCookie });
check('project get one', r.status, 200, json(r));

r = await call('GET', '/projects/123e4567-e89b-42d3-a456-426614174000', { cookie: clientCookie });
check('project get unknown id', r.status, 404, json(r));

r = await call('GET', '/projects/not-a-uuid', { cookie: clientCookie });
check('project get invalid uuid', r.status, 400, json(r));

r = await call('PATCH', `/projects/${projectId}`, { body: { title: 'Hacked' }, cookie: client2Cookie });
check('project update by non-owner', r.status, 403, json(r));

r = await call('PATCH', `/projects/${projectId}`, { body: { title: 'Smoke Project Updated', budget: 700 }, cookie: clientCookie });
check('project update by owner', r.status, 200, json(r));

r = await call('PATCH', `/projects/${projectId}`, { body: {}, cookie: clientCookie });
check('project update empty body', r.status, 200, json(r));

r = await call('PATCH', `/projects/${projectId}`, { body: { budget: -5 }, cookie: clientCookie });
check('project update invalid budget', r.status, 400, json(r));

r = await call('DELETE', `/projects/${projectId}`, { cookie: client2Cookie });
check('project delete by non-owner', r.status, 403, json(r));

r = await call('DELETE', `/projects/${projectId}`, { cookie: clientCookie });
check('project delete by owner', r.status, 200, json(r));

r = await call('DELETE', `/projects/${projectId}`, { cookie: clientCookie });
check('project delete already deleted', r.status, 404, json(r));

// ---------- LOGOUT ----------
r = await call('POST', '/auth/logout', { cookie: freelancerCookie });
check('logout', r.status, 200, json(r));

r = await call('GET', '/auth/me', { cookie: freelancerCookie });
check('auth/me after logout (revoked)', r.status, 401, json(r));

console.log(results.join('\n'));
console.log(`\nTOTAL ${pass + fail} | PASS ${pass} | FAIL ${fail}`);
console.log(`freelancerEmail=${freelancerEmail}`);
console.log(`clientEmail=${clientEmail}`);
console.log(`client2Email=${client2Email}`);
process.exitCode = fail ? 1 : 0;
