'use client';

import { useParams } from 'next/navigation';
import { CustomerBillPayment } from '../customer-bill-payment';

export const dynamic = 'force-dynamic';

export default function CustomerBillDetailPage() {
  const params = useParams();
  return <CustomerBillPayment billIdParam={params?.id as string} />;
}
