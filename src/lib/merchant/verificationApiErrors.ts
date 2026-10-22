import { NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/apiGuards';

export function merchantVerificationApiError(error: unknown, action: string) {
  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 500;

  if (statusCode === 401 || statusCode === 403) {
    return authErrorResponse(error);
  }

  console.error(`${action}:`, error);
  return NextResponse.json({ error: `${action} Please try again.` }, { status: 500 });
}
