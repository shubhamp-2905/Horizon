import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Horizon — Geospatial Ground-Truth Infrastructure & Verification Protocol',
  description: 'Decentralized geospatial field-data collection, multi-layer cryptographic and AI verification, and tokenized consensus engine for high-resolution ground truth.',
  keywords: ['geospatial', 'ground truth', 'field verification', 'postgis', 'decentralized', 'loupe AI', 'tokens'],
};

export const viewport: Viewport = {
  themeColor: '#07080A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
