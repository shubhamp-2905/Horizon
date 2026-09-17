import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Horizon Reviewer & Admin Console',
  description: 'Authoritative management and verification console for the Horizon geospatial contribution platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
