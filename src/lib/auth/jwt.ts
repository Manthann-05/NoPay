import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { UserRole } from '@/types';

/**
 * SECURITY: AUTH_SECRET must be provided via environment variables.
 * The application will fail at startup if this is missing.
 * Never use a hardcoded fallback JWT secret in production.
 */
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      '[NoPay] FATAL: AUTH_SECRET environment variable is not set. ' +
      'The application cannot start without a strong JWT signing secret. ' +
      'Please set AUTH_SECRET in your .env file.'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      '[NoPay] FATAL: AUTH_SECRET is too short (minimum 32 characters required). ' +
      'Please use a strong randomly generated secret.'
    );
  }
  return secret;
}

const TOKEN_COOKIE_NAME = 'nopay_session';

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  roles: UserRole[];
  activeRole: UserRole;
  merchantProfileId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getAuthSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getAuthSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<JwtPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(payload: JwtPayload): Promise<string> {
  const token = signToken(payload);
  const cookieStore = cookies();
  cookieStore.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  return token;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(TOKEN_COOKIE_NAME);
}

/**
 * Helper for API routes that require an authenticated merchant session.
 * Throws a descriptive error if the session is missing or role is wrong.
 */
export function requireMerchantSession(session: JwtPayload | null): asserts session is JwtPayload {
  if (!session) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  }
  if (!session.roles.includes('MERCHANT') || session.activeRole !== 'MERCHANT') {
    throw Object.assign(new Error('Merchant authorization required'), { statusCode: 403 });
  }
}

/**
 * Helper for API routes that require any authenticated user session.
 */
export function requireSession(session: JwtPayload | null): asserts session is JwtPayload {
  if (!session) {
    throw Object.assign(new Error('Authentication required. Please sign in.'), { statusCode: 401 });
  }
}
