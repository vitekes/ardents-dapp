import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SignJWT } from 'jose';
import prisma from '@/lib/prisma';

// Для этого обработчика нужен доступ к TCP-сокету Postgres, поэтому используем Node-runtime
export const runtime = 'nodejs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'insecure');

function formatCaip10(chain: string, address: string) {
  return `${chain}:${address.toLowerCase()}`;
}

async function verifyEvm(message: string, signature: string) {
  const msg = new SiweMessage(message);
  await msg.verify({ signature });
  return msg.address;
}

async function verifySol(message: string, signature: string, address: string) {
  const pubKey = new PublicKey(address);
  const ok = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    bs58.decode(signature),
    pubKey.toBytes(),
  );
  if (!ok) throw new Error('Invalid signature');
  return pubKey.toBase58();
}

export async function POST(req: NextRequest) {
  try {
    const { chain, message, signature, address } = await req.json();

    let walletAddr: string;
    if (chain.startsWith('eip155')) {
      walletAddr = await verifyEvm(message, signature);
    } else if (chain.startsWith('solana')) {
      if (!address) throw new Error('address required');
      walletAddr = await verifySol(message, signature, address);
    } else {
      return NextResponse.json({ error: 'unsupported chain' }, { status: 400 });
    }
    const caip10 = formatCaip10(chain, walletAddr);

    let userId: string;
    const wallet = await prisma.wallet.findUnique({
      where: { caip10_id: caip10 },
      select: { user_id: true },
    });

    if (wallet) {
      userId = wallet.user_id;
    } else {
      const user = await prisma.siteUser.create({
        data: {
          display_name: walletAddr.slice(0, 6),
          wallets: {
            create: { caip10_id: caip10, is_primary: true },
          },
        },
        select: { id: true },
      });
      userId = user.id;
    }

      const token = await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setExpirationTime('1h')
        .sign(JWT_SECRET);

      return NextResponse.json({ token }, { status: 200 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

