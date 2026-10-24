import type { ReactNode } from 'react';

// Nested layout: must NOT render <html>/<body> (the root app/layout.tsx owns those).
export const metadata = {
  title: 'GoLan - vision test',
  description: 'Hand-tracking and sign-pack recording harness',
};

export default function VisionTestLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
