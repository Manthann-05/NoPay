import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      <h2 className="text-3xl font-black text-navy-900">404 - Page Not Found</h2>
      <p className="text-xs text-slate-500">The page or resource you are looking for does not exist.</p>
      <Link
        href="/"
        className="inline-block px-6 py-3 bg-brand-blue text-white text-xs font-bold rounded-xl shadow-md"
      >
        Return Home
      </Link>
    </div>
  );
}
