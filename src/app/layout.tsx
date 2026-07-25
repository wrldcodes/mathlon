import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/index.css';
import { AppProviders } from './providers/AppProviders';

export const metadata: Metadata = {
  title: {
    default: 'Mathlon',
    template: '%s · Mathlon',
  },
  description: 'Learn math with an interactive AI tutor.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
