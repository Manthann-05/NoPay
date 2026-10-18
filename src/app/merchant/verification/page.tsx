import { MerchantVerificationForm } from './merchant-verification-form';

export default function MerchantVerificationPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-black text-navy-900">Shop verification</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage business identity details and supporting documents.
        </p>
      </div>
      <MerchantVerificationForm />
    </div>
  );
}
