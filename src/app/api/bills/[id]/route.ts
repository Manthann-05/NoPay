import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Bill } from '@/models/Bill';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';
import { isBillExpired } from '@/lib/status/labels';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getRequiredSession();
    await connectToDatabase();
    const bill = await Bill.findOne({ billId: params.id });
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const isMerchantOwner =
      session.roles.includes('MERCHANT') &&
      session.merchantProfileId &&
      String(bill.merchantId) === String(session.merchantProfileId);

    if (session.activeRole === 'MERCHANT' && !isMerchantOwner) {
      return NextResponse.json({ error: 'You are not allowed to access this bill.' }, { status: 403 });
    }

    if (isBillExpired(bill.expiresAt)) {
      return NextResponse.json({ error: 'Bill Expired' }, { status: 410 });
    }

    return NextResponse.json({ bill });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: 'Failed to fetch bill' }, { status: 500 });
  }
}
