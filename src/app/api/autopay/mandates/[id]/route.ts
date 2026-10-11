import { NextResponse } from 'next/server';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import { AutoPayMandate } from '@/models/AutoPayMandate';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequiredSession();
    if (!session.roles.includes('CUSTOMER')) {
      return NextResponse.json({ error: 'Customer access is required.' }, { status: 403 });
    }
    const { id } = await params;
    await connectToDatabase();

    const mandate = await AutoPayMandate.findOne({
      _id: id,
      customerId: session.userId,
    }).select('+razorpayCustomerId +razorpayTokenId');
    if (!mandate) {
      return NextResponse.json({ error: 'Mandate not found.' }, { status: 404 });
    }
    if (mandate.status === 'REVOKED') {
      return NextResponse.json({ status: mandate.status });
    }
    if (mandate.status === 'CANCELLATION_PENDING') {
      return NextResponse.json({ status: mandate.status });
    }
    if (!mandate.razorpayTokenId) {
      return NextResponse.json(
        { error: 'This mandate is not yet active. Wait for Razorpay authorization to finish.' },
        { status: 409 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
    }

    const providerResponse = await fetch(
      `https://api.razorpay.com/v1/customers/${encodeURIComponent(mandate.razorpayCustomerId)}/tokens/${encodeURIComponent(mandate.razorpayTokenId)}/cancel`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        },
        cache: 'no-store',
      }
    );
    const providerData = await providerResponse.json().catch(() => null);
    if (!providerResponse.ok || providerData?.status !== 'cancellation_initiated') {
      const errorCode =
        typeof providerData?.error?.code === 'string' ? providerData.error.code : 'CANCELLATION_FAILED';
      return NextResponse.json(
        { error: `Razorpay could not confirm mandate cancellation (${errorCode}).` },
        { status: 502 }
      );
    }

    mandate.status = 'CANCELLATION_PENDING';
    await mandate.save();
    return NextResponse.json({ status: mandate.status });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('AutoPay mandate cancellation failed:', err);
    return NextResponse.json({ error: 'Could not request mandate cancellation.' }, { status: 500 });
  }
}
