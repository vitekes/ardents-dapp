import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request, { params }: { params: { id: string; wallet: string } }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE wallets SET is_primary=false WHERE user_id=$1', [params.id]);
    await client.query('UPDATE wallets SET is_primary=true WHERE caip10_id=$1 AND user_id=$2', [params.wallet, params.id]);
    await client.query('UPDATE site_users SET primary_wallet=$1 WHERE id=$2', [params.wallet, params.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : 'unable to set primary';
    return NextResponse.json({ error: msg }, { status: 400 });
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}
