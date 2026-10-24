import type { ReactNode } from 'react';

export const metadata = {
  title: 'GoLan',
  description: 'Two-way communication bridge between sign language and speech at service counters.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
