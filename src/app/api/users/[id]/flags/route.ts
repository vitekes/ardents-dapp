import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const runtime = 'nodejs';

type Params = { id: string };
type Ctx = { params: Params };

/* GET /api/users/[id]/flags */
export async function GET(
  _req: Request,
  { params }: Ctx,            // ← убрали Promise, сразу деструктурируем
) {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT flag FROM user_flags WHERE user_id = $1',
        [params.id],
      );
      const flags = res.rows.map((r) => r.flag as string);
      return NextResponse.json({ flags });
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/* POST /api/users/[id]/flags   body: { flag: string } */
export async function POST(
  req: Request,
  { params }: Ctx,            // ← то же здесь
) {
  try {
    const { flag } = (await req.json()) as { flag?: string };
    if (!flag) {
      return NextResponse.json({ error: 'flag required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO user_flags (user_id, flag)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [params.id, flag],
      );
      return NextResponse.json({ ok: true }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}