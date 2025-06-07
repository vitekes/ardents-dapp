import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string; wallet: string } }) {
  try {
    await prisma.$transaction([
      prisma.wallet.updateMany({
        where: { user_id: params.id },
        data: { is_primary: false },
      }),
      prisma.wallet.update({
        where: { caip10_id: params.wallet },
        data: { is_primary: true },
      }),
      prisma.siteUser.update({
        where: { id: params.id },
        data: { primary_wallet: params.wallet },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unable to set primary';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
