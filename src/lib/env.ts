/**
 * Environment Variable Validation for NoPay
 * Validates required environment variables at server runtime startup.
 *
 * CLIENT-SAFE: only NEXT_PUBLIC_* variables may be referenced in client components.
 * SERVER-ONLY: AUTH_SECRET, MONGODB_URI, RAZORPAY_KEY_SECRET must never be imported from client code.
 */

export interface EnvConfig {
  MONGODB_URI: string;
  AUTH_SECRET: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
}

let validatedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (validatedEnv) return validatedEnv;

  const MONGODB_URI = process.env.MONGODB_URI;
  const AUTH_SECRET = process.env.AUTH_SECRET;

  const errors: string[] = [];

  if (!MONGODB_URI || MONGODB_URI.trim() === '') {
    errors.push('MONGODB_URI is missing from environment variables.');
  }

  if (!AUTH_SECRET || AUTH_SECRET.trim() === '') {
    errors.push('AUTH_SECRET is missing from environment variables.');
  } else if (AUTH_SECRET.length < 32) {
    errors.push('AUTH_SECRET must be at least 32 characters long.');
  }

  if (errors.length > 0) {
    const errorMsg =
      `[NoPay Environment Config Error]\n` +
      errors.map((e) => `  - ${e}`).join('\n') +
      `\nSet these in .env.local. The application cannot start without them.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  validatedEnv = {
    MONGODB_URI: MONGODB_URI as string,
    AUTH_SECRET: AUTH_SECRET as string,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  };

  return validatedEnv;
}
