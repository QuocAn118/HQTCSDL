'use client';
import type { ReactNode } from 'react';
import { AuthGate } from '@/lib/auth';

export default function HousesLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
