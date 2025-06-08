#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { existsSync, readdirSync } = require('fs');
const path = require('path');


const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
if (!existsSync(migrationsDir) || readdirSync(migrationsDir).length === 0) {
  console.error('No Prisma migrations found. Run "npx prisma migrate dev" to create one or use "npx prisma db push" to sync the schema.');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 0);
