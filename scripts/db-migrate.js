#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'migrations', '001_init.sql');
const result = spawnSync('psql', ['-f', file, dbUrl], { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 0);
