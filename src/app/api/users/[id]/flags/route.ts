import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (req.headers.get('x-admin-token') !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }
  const { flag } = await req.json();
  if (!flag) {
    return NextResponse.json({ error: 'flag required' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('INSERT INTO user_flags(user_id, flag) VALUES ($1,$2) ON CONFLICT DO NOTHING', [params.id, flag]);
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}
