import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyEdgeJwt } from '@/lib/auth/edgeJwt';
import { getEnv } from '@/lib/env';

const TOKEN_COOKIE_NAME = 'nopay_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isCustomerRoute = pathname.startsWith('/customer');
  const isMerchantRoute = pathname.startsWith('/merchant');
  const isMerchantSetup = pathname.startsWith('/merchant-setup');

  if (!isCustomerRoute && !isMerchantRoute && !isMerchantSetup) {
    return NextResponse.next();
  }

  const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
  const secret = getEnv().AUTH_SECRET;

  if (!token || !secret) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyEdgeJwt(token, secret);

  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'expired');
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isMerchantRoute) {
    const hasMerchantRole = Array.isArray(payload.roles) && payload.roles.includes('MERCHANT');
    if (!hasMerchantRole) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/customer/:path*', '/merchant/:path*', '/merchant-setup'],
};
