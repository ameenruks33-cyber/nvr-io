#!/usr/bin/env node
/**
 * Post-deploy checks: TLS/HSTS, API health, two-factor policy, encryption at rest.
 * Used by GitHub Actions after push → Vercel.
 */
const API = process.env.VERIFY_API_URL || 'https://nvr-io-api.vercel.app/api';
const WEB = process.env.VERIFY_WEB_URL || 'https://nvr-io-web.vercel.app';

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error('FAIL:', msg);
}

async function getJson(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

async function main() {
  console.log('Verifying production security…');
  console.log('API:', API);
  console.log('Web:', WEB);

  const health = await getJson(`${API}/health`);
  if (health.res.status !== 200) {
    fail(`API health HTTP ${health.res.status}`);
  }

  const sec = await getJson(`${API}/health/security`);
  if (sec.res.status !== 200) {
    fail(`API security HTTP ${sec.res.status}`);
  } else if (typeof sec.body === 'object') {
    if (!sec.body.atRest?.encryptionKeyConfigured) {
      fail('FIELD_ENCRYPTION_KEY not configured on API (at-rest encryption off)');
    }
    if (!sec.body.twoFactor?.required) {
      fail('Two-factor login is not required on production API');
    }
    if (sec.body.atRest?.algorithm !== 'AES-256-GCM') {
      fail('Unexpected at-rest algorithm');
    }
    if (sec.body.status !== 'verified') {
      fail(`Security status is ${sec.body.status}, expected verified`);
    }
  }

  const hstsApi = sec.res.headers.get('strict-transport-security');
  if (!hstsApi) fail('API missing Strict-Transport-Security header');

  const web = await fetch(`${WEB}/login`, { redirect: 'follow' });
  if (web.status !== 200) fail(`Web login page HTTP ${web.status}`);
  const hstsWeb = web.headers.get('strict-transport-security');
  if (!hstsWeb) fail('Web missing Strict-Transport-Security header');

  const protectedRoute = await fetch(`${API}/notifications`);
  if (protectedRoute.status !== 401) {
    fail(`Protected API should return 401 without token, got ${protectedRoute.status}`);
  }

  if (failures.length) {
    console.error('\nVerification failed:', failures.length, 'issue(s)');
    process.exit(1);
  }
  console.log('\nOK: two-factor policy, encryption at rest, TLS headers, and auth gate verified.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
