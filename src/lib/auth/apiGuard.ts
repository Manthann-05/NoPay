import { NextResponse } from 'next/server';
import { getSessionUser, type JwtPayload } from '@/lib/auth/jwt';

function authErrorResponse(status: number, message: string) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function requireApiSession(): Promise<
  { session: JwtPayload; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getSessionUser();
  if (!session) {
    return {
      error: authErrorResponse(401, 'Your session has expired. Please sign in again.'),
    };
  }
  return { session };
}

export async function requireApiMerchant(): Promise<
  { session: JwtPayload; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const result = await requireApiSession();
  if (result.error) return result;
  const { session } = result;
  if (!session.roles.includes('MERCHANT') || !session.merchantProfileId) {
    return {
      error: authErrorResponse(403, 'This area is for merchant accounts.'),
    };
  }
  return { session };
}
