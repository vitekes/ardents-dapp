#!/usr/bin/env node
const { spawnSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 0);
