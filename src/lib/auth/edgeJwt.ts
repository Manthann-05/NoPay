/**
 * HMAC-SHA256 JWT verification for Next.js Edge middleware.
 * Does not use jsonwebtoken (Node-only).
 */

export interface EdgeJwtPayload {
  userId?: string;
  email?: string;
  name?: string;
  roles?: string[];
  activeRole?: string;
  merchantProfileId?: string;
  exp?: number;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  const bytes = base64UrlToUint8Array(base64Url);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return arrayBuffer;
}

export async function verifyEdgeJwt(token: string, secret: string): Promise<EdgeJwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToArrayBuffer(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );

    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlToArrayBuffer(parts[1]));
    const payload = JSON.parse(payloadJson) as EdgeJwtPayload;

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
