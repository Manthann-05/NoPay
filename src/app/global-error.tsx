'use client';

// Force dynamic rendering to avoid pre-rendering issues
export const dynamic = 'force-dynamic';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0b192c', marginBottom: '1rem' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1.5rem' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#2563eb',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: '700',
              borderRadius: '0.75rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}