#!/usr/bin/env node
/**
 * npm run ship — commit (if needed) + push main.
 * Vercel projects are Git-connected, so push triggers production deploy.
 */
const { execSync } = require('node:child_process');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function capture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', shell: true }).trim();
  } catch {
    return '';
  }
}

const dirty = capture('git status --porcelain');
if (dirty) {
  run('git add -A');
  try {
    run('git reset HEAD -- .env .env.local .env.production backend/.env.vercel');
  } catch {
    /* ignore */
  }
  const msg =
    process.env.SHIP_MESSAGE ||
    `Ship: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  try {
    run(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
  } catch {
    console.log('No commit created (nothing staged or hook blocked).');
  }
}

const branch = capture('git rev-parse --abbrev-ref HEAD') || 'main';
run(`git push -u origin ${branch}`);

console.log(`
Shipped to GitHub (${branch}).
Vercel will auto-build:
  • https://nvr-io-web.vercel.app
  • https://nvr-io-api.vercel.app
Cloudflare: proxy your domain to Vercel when DNS is configured (see infrastructure/cloudflare/README.md).
`);
