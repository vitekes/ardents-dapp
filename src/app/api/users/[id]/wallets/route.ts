import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const caip10 = formData.get('caip10');
  const label = formData.get('label');
  if (!caip10) {
    return NextResponse.json({ error: 'caip10 required' }, { status: 400 });
  }
  await prisma.wallet.upsert({
    where: { caip10_id: caip10.toString() },
    update: {},
    create: {
      caip10_id: caip10.toString(),
      user_id: params.id,
      label: label ? label.toString() : null,
    },
  });

  return NextResponse.json({ ok: true });
}
