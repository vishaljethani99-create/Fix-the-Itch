import type { ReactNode } from 'react';

export const metadata = {
  title: 'Fix the Itch',
  description: 'Accessible communication tools for service counters.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
