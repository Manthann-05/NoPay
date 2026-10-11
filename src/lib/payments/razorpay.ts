import Razorpay from 'razorpay';

export function isRazorpayRouteEnabled(): boolean {
  return process.env.RAZORPAY_ROUTE_ENABLED === 'true';
}

export function isRazorpayAutoPayEnabled(): boolean {
  return process.env.RAZORPAY_AUTOPAY_ENABLED === 'true';
}

export function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay API credentials are not configured.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'RazorpayApiError';
  }
}

export async function razorpayRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: Record<string, unknown>,
  idempotencyKey?: string
): Promise<T> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay API credentials are not configured.');
  }

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Transfer-Idempotency': idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      typeof data?.error?.code === 'string' ? data.error.code : 'PROVIDER_REQUEST_FAILED';
    throw new RazorpayApiError('Razorpay request failed.', response.status, code);
  }
  return data as T;
}
