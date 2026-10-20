'use client';

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
      <head>
        <title>Error - NoPay</title>
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#090d16', color: '#f1f5f9' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>
            Application Error
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '28rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 700,
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