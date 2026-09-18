import { NextResponse } from 'next/server';
import { getSessionUser, requireMerchantSession, requireSession, type JwtPayload } from '@/lib/auth/jwt';

export async function getRequiredSession(): Promise<JwtPayload> {
  const session = await getSessionUser();
  requireSession(session);
  return session;
}

export async function getRequiredMerchantSession(): Promise<JwtPayload> {
  const session = await getSessionUser();
  requireMerchantSession(session);
  return session;
}

export function authErrorResponse(err: unknown): NextResponse {
  const statusCode =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? Number((err as { statusCode?: number }).statusCode)
      : 500;
  const message = err instanceof Error ? err.message : 'Request failed';
  const safeStatus = statusCode === 401 || statusCode === 403 ? statusCode : statusCode || 500;
  const userMessage =
    safeStatus === 401
      ? 'Your session has expired. Please sign in again.'
      : safeStatus === 403
        ? 'You are not allowed to access this resource.'
        : message;
  return NextResponse.json({ success: false, error: userMessage }, { status: safeStatus });
}
