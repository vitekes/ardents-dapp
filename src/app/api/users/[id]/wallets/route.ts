import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const caip10 = formData.get('caip10');
  const label = formData.get('label');
  if (!caip10) {
    return NextResponse.json({ error: 'caip10 required' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO wallets(caip10_id, user_id, label) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [caip10.toString(), params.id, label ? label.toString() : null],
    );
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}
