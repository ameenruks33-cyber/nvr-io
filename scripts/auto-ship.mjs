#!/usr/bin/env node
/**
 * npm run ship — commit (if needed) + push main.
 * Vercel projects are Git-connected, so push triggers production deploy.
 */
import { execSync } from 'node:child_process';

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
  // drop secrets if staged
  run('git reset HEAD -- .env .env.* **/ .env.vercel backend/.env.vercel 2>nul || true');
  const msg =
    process.env.SHIP_MESSAGE ||
    `Ship: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  run(`git commit -m "${msg.replace(/"/g, '\\"')}" || echo No commit`);
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
