import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/shared/Navbar';
import { getSessionUser } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { MerchantProfile } from '@/models/MerchantProfile';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'NoPay - Offline-First Billing & QR Synchronization',
  description: 'Offline-First Billing, QR Payment & Synchronization System for Customers and Merchants',
  manifest: '/manifest.json',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let sessionUser = null;

  try {
    const session = await getSessionUser();
    if (session) {
      await connectToDatabase();
      const user = await User.findById(session.userId);

      if (user) {
        let merchantProfile = null;
        if (user.merchantProfileId) {
          merchantProfile = await MerchantProfile.findById(user.merchantProfileId);
        }

        sessionUser = {
          name: user.name,
          email: user.email,
          roles: user.roles,
          activeRole: user.activeRole,
          merchantProfile: merchantProfile ? {
            shopName: merchantProfile.shopName,
          } : null,
        };
      }
    }
  } catch (err) {
    // Session fallback if DB offline
  }

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-brand-blue selection:text-white">
        <Navbar user={sessionUser} />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-bold text-navy-900">NoPay</span> &copy; 2026. Offline-First POS & QR Payment System.
            </div>
            <div className="flex items-center gap-4 text-slate-500">
              <span>Status: Resilient PWA</span>
              <span>•</span>
              <span>Razorpay Test Mode Integration</span>
            </div>
          </div>
        </footer>

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
