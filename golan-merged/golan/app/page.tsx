'use client';
import type { ComponentType } from 'react';
import GoLanLanding from '../components/GoLan';

// GoLan.jsx is plain JS; give it an explicit prop type rather than relying on inference.
const GoLan = GoLanLanding as unknown as ComponentType<{ appHref?: string }>;

export default function Home() {
  return <GoLan appHref="#studio" />;
}
