#!/usr/bin/env node
/**
 * Bump apps/web/public/app-update.json so installed devices see a new update.
 * Usage: node scripts/bump-app-update.cjs [message]
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'apps', 'web', 'public', 'app-update.json');
const rootPkg = require(path.join(__dirname, '..', 'package.json'));

const current = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : { version: '1.0.0', notes: [] };

function bumpPatch(v) {
  const parts = String(v || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

const now = new Date();
const build = [
  now.getUTCFullYear(),
  String(now.getUTCMonth() + 1).padStart(2, '0'),
  String(now.getUTCDate()).padStart(2, '0'),
  String(now.getUTCHours()).padStart(2, '0'),
  String(now.getUTCMinutes()).padStart(2, '0'),
].join('.');

const noteArg = process.argv.slice(2).join(' ').trim();
const notes = Array.isArray(current.notes) ? [...current.notes] : [];
if (noteArg) notes.unshift(noteArg);
while (notes.length > 8) notes.pop();

const next = {
  app: 'NVR.io',
  version: bumpPatch(current.version || rootPkg.version || '1.0.0'),
  build,
  releasedAt: now.toISOString(),
  title: 'NVR.io update available',
  message:
    noteArg ||
    current.message ||
    'A new version of NVR.io is ready. Tap Update to install on this device.',
  notes,
  minVersion: current.minVersion || '1.0.0',
  force: Boolean(current.force),
  updateUrl: '/updates',
};

fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
console.log(`Updated app-update.json → v${next.version} (${next.build})`);
