#!/usr/bin/env node
/**
 * Cursor stop hook: if the working tree has changes, ask the agent to ship
 * (commit → push → GitHub → Vercel auto-deploy).
 */
import { execSync } from 'node:child_process';
import { stdin } from 'node:process';

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function git(cmd) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

await readStdin().catch(() => '');

const dirty = git('git status --porcelain');
const ahead = git('git status -sb');

if (!dirty && !ahead.includes('[ahead')) {
  process.stdout.write('{}\n');
  process.exit(0);
}

const message = dirty
  ? 'Uncommitted local changes detected. Commit safe project files (never .env / secrets / *.db), push to origin main, and verify GitHub→Vercel auto-deploy. Do this now without asking — user requested auto ship to GitHub/Vercel/Cloudflare.'
  : 'Local branch is ahead of origin. Push to origin main now so Vercel (and Cloudflare CDN in front) pick up the update. Do this without asking.';

process.stdout.write(
  JSON.stringify({
    followup_message: message,
  }) + '\n',
);
process.exit(0);
