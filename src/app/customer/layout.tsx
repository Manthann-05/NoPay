'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  useRequireAuth();
  return <>{children}</>;
}
