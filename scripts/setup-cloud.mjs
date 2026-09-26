#!/usr/bin/env node
/**
 * NVR.io — interactive cloud setup helper (Vercel + Cloudflare).
 * Run: npm run cloud:setup
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  return r.status === 0;
}

function writeEnvExampleProd() {
  const file = path.join(root, '.env.production.example');
  if (!fs.existsSync(file)) {
    console.log('.env.production.example already managed in repo');
  } else {
    console.log('Using existing .env.production.example');
  }
}

async function main() {
  console.log('NVR.io cloud setup — Vercel + Cloudflare\n');
  writeEnvExampleProd();

  console.log('\n1) Log in to Vercel (browser will open)...');
  run('npx', ['--yes', 'vercel', 'login']);

  console.log('\n2) Link / create Web project (apps/web)...');
  run('npx', ['--yes', 'vercel', 'link', '--yes'], path.join(root, 'apps', 'web'));

  console.log('\n3) Link / create API project (backend)...');
  run('npx', ['--yes', 'vercel', 'link', '--yes'], path.join(root, 'backend'));

  console.log('\n4) Log in to Cloudflare Wrangler...');
  run('npx', ['--yes', 'wrangler', 'login']);

  console.log('\n5) Create R2 bucket (ignore error if it already exists)...');
  run(
    'npx',
    ['--yes', 'wrangler', 'r2', 'bucket', 'create', 'nvr-io-uploads'],
    path.join(root, 'infrastructure', 'cloudflare'),
  );

  console.log(`
Done with CLI linking.

Next (required for a working cloud deploy):
  A. Create a Neon Postgres DB (https://neon.tech or Vercel → Storage → Neon)
  B. Put DATABASE_URL + secrets into BOTH Vercel projects (Settings → Environment Variables)
     Use values from .env.production.example as a checklist
  C. Create Cloudflare R2 API tokens; set R2_* on the API project
  D. Add your domain in Cloudflare DNS → CNAME to Vercel
  E. Deploy:
       npm run cloud:deploy:web
       npm run cloud:deploy:api
  F. For production DB: set Prisma provider to postgresql, then:
       cd backend && npx prisma db push && npx prisma db seed

See infrastructure/cloudflare/README.md and docs/DEPLOYMENT.md
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
