'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  useRequireAuth();
  return <>{children}</>;
}
