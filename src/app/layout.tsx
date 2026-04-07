import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SolanaProvider } from '@/providers/SolanaProvider';
import { FineticProvider } from '@/providers/FineticProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Finetic Protocol — Solo para gente segura',
  description: 'Marketplace P2P de préstamos cripto. Sin liquidación. Sin oráculos. Tu colateral, tu control.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <SolanaProvider>
          <FineticProvider>
            {children}
          </FineticProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}
