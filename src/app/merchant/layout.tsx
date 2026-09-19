'use client';

import { useRequireMerchant } from '@/hooks/useRequireAuth';

// Force dynamic rendering to avoid pre-rendering issues with client-side hooks
export const dynamic = 'force-dynamic';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  useRequireMerchant();
  return <>{children}</>;
}
