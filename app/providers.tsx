'use client';

import { ThirdwebProvider } from '@thirdweb-dev/react';
import { Chain } from '@thirdweb-dev/chains';
import type { ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';

// Memoize chain configuration
const somniaChain: Chain = {
  chainId: 50312, // 0xc488
  rpc: [
    "https://dream-rpc.somnia.network",
    "https://rpc.ankr.com/somnia_testnet/6e3fd81558cf77b928b06b38e9409b4677b637118114e83364486294d5ff4811"
  ],
  nativeCurrency: {
    decimals: 18,
    name: "STT",
    symbol: "STT",
  },
  shortName: "somnia-testnet",
  slug: "somnia-testnet",
  testnet: true,
  chain: "Somnia Testnet",
  name: "Somnia Testnet",
  // Added block gas limit
  explorers: [{
    name: "Somnia Explorer",
    url: "https://explorer.somnia.network",
    standard: "EIP3091"
  }]
} as const;

// Configure query client for better performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Provider options for better performance
const providerOptions = {
  autoConnect: true,
  theme: "dark", // Changed to dark to match your theme
  dAppMeta: {
    name: "Dark Table CCG",
    description: "Mint your Under The Table Pass NFT",
    logoUrl: "/DarkTable_LOGO-KeyWhite.png",
    url: "https://darktableccg.com",
  },
} as const;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThirdwebProvider
      activeChain={somniaChain}
      clientId="edb48568fb7d868b3e941902616fb13c"  // Your client ID
      queryClient={queryClient}
      {...providerOptions}
    >
      {children}
    </ThirdwebProvider>
  );
}
