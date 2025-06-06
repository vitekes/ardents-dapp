'use client';

import { createConfig, http } from 'wagmi';
import { mainnet, base, bsc } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { viem } from 'wagmi/providers/viem';

export const wagmiConfig = createConfig({
    chains: [mainnet, base, bsc],
    connectors: [
        injected({ shimDisconnect: true }),
        walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_ID! }),
    ],
    transports: {
        [mainnet.id]: http(),
        [base.id]: http(),
        [bsc.id]: http(),
    },
    providers: [viem()],
});
