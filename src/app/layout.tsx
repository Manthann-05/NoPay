import type { Metadata } from 'next';
import './globals.css';
import { NavbarWrapper } from '@/components/shared/NavbarWrapper';
import { SnackbarProvider } from '@/components/shared/SnackbarProvider';

export const metadata: Metadata = {
  title: 'NoPay - Offline-First Billing & QR Synchronization',
  description: 'Offline-First Billing, QR Payment & Synchronization System for Customers and Merchants',
  manifest: '/manifest.json',
};

import { ThemeProvider } from '@/components/shared/ThemeProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background text-foreground selection:bg-foreground selection:text-background transition-colors duration-150">
        <ThemeProvider>
          <SnackbarProvider>
            <NavbarWrapper />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </main>

            <footer className="border-t-2 border-border bg-surface py-8 mt-12 text-xs font-mono text-foreground">
              <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-black text-foreground uppercase tracking-wider">NOPAY</span>
                  <span className="text-foreground-muted">&copy; 2026</span>
                </div>
                <div className="flex items-center gap-4 text-foreground font-bold text-[11px] uppercase">
                  <span className="inline-flex items-center gap-1.5 border border-border px-2 py-0.5 bg-background">
                    <span className="w-1.5 h-1.5 bg-foreground"></span>
                    PWA RESILIENT
                  </span>
                </div>
              </div>
            </footer>
          </SnackbarProvider>
        </ThemeProvider>

        {/* Service Worker Registration Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('NoPay ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('NoPay ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
