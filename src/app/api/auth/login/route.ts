import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

export const runtime = 'edge';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';

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

    const client = await pool.connect();
    try {
      let res = await client.query('SELECT user_id FROM wallets WHERE caip10_id=$1', [caip10]);
      let userId: string;
      if (res.rowCount) {
        userId = res.rows[0].user_id;
      } else {
        res = await client.query('INSERT INTO site_users(display_name) VALUES($1) RETURNING id', [walletAddr.slice(0,6)]);
        userId = res.rows[0].id;
        await client.query('INSERT INTO wallets(caip10_id, user_id, is_primary) VALUES ($1,$2,true)', [caip10, userId]);
      }
      const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
      return NextResponse.json({ token }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

