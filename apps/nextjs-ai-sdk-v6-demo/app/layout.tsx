import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI SDK v6 + ai-spans demo',
  description: 'Minimal Next.js App Router chat using AI SDK v6 and local ai-spans observability',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
