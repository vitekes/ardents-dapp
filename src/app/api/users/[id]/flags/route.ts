import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

type Params = { id: string };

/* GET /api/users/[id]/flags */
export async function GET(
  _req: Request,
  { params }: { params: Params }, // inline context type
) {
  try {
    const res = await prisma.userFlag.findMany({
      where: { user_id: params.id },
      select: { flag: true },
    });
    const flags = res.map((r) => r.flag);
    return NextResponse.json({ flags });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/* POST /api/users/[id]/flags   body: { flag: string } */
export async function POST(
  req: Request,
  { params }: { params: Params }, // inline context type
) {
  try {
    const { flag } = (await req.json()) as { flag?: string };
    if (!flag) {
      return NextResponse.json({ error: 'flag required' }, { status: 400 });
    }

    await prisma.userFlag.upsert({
      where: { user_id_flag: { user_id: params.id, flag } },
      create: { user_id: params.id, flag },
      update: {},
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}