import { Crimson_Text } from 'next/font/google';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

const crimsonText = Crimson_Text({ 
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Under The Table Pass | Dark Table CCG',
  description: 'Mint your Under The Table Pass NFT',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={crimsonText.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
