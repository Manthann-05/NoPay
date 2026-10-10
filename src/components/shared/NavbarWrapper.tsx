'use client';

import dynamic from 'next/dynamic';

// Dynamically import Navbar with SSR disabled to avoid pre-rendering issues
// with browser-only hooks (useRouter, usePathname, useOnlineStatus)
const Navbar = dynamic(
  () => import('./Navbar').then((mod) => mod.Navbar),
  {
    ssr: false,
    loading: () => (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="w-full px-4 sm:px-6 h-16" />
      </header>
    ),
  }
);

export function NavbarWrapper() {
  return <Navbar />;
}