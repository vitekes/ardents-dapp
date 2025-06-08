import Database from 'better-sqlite3';

// DATABASE_URL should be something like 'file:./dev.db'
const url = process.env.DATABASE_URL || 'file:dev.db';
const path = url.replace(/^file:/, '');
const db = new Database(path);

export default db;
