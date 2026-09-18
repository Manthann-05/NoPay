'use client';

import { useRequireMerchant } from '@/hooks/useRequireAuth';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  useRequireMerchant();
  return <>{children}</>;
}
