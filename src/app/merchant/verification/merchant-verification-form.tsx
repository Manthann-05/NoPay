'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  MERCHANT_VERIFICATION_BUSINESS_TYPES,
  MERCHANT_VERIFICATION_DOCUMENT_LABELS,
  MERCHANT_VERIFICATION_DOCUMENT_TYPES,
  MERCHANT_VERIFICATION_MAX_FILE_BYTES,
} from '@/lib/merchant/verification';
import type { MerchantVerificationBusinessType, MerchantVerificationDocumentType } from '@/types/merchant-verification';
import { AlertCircle, CheckCircle2, Eye, FileCheck2, ShieldAlert, Upload } from 'lucide-react';

interface VerificationDocument {
  documentId: string;
  documentType: MerchantVerificationDocumentType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: 'UPLOADING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  uploadedAt: string | null;
}

interface VerificationData {
  shopName: string;
  legalBusinessName: string;
  businessType: MerchantVerificationBusinessType | '';
  gstin: string;
  businessAddress: string;
  status: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'NEEDS_CHANGES' | 'VERIFIED';
  submittedAt: string | null;
  documents: VerificationDocument[];
}

const BUSINESS_TYPE_LABELS: Record<MerchantVerificationBusinessType, string> = {
  individual: 'Individual',
  proprietorship: 'Sole proprietorship',
  partnership: 'Partnership',
  private_limited: 'Private limited company',
  public_limited: 'Public limited company',
  llp: 'Limited liability partnership',
  other: 'Other',
};

const DOCUMENT_STATUS_LABELS: Record<VerificationDocument['status'], string> = {
  UPLOADING: 'Upload incomplete',
  PENDING_REVIEW: 'Received',
  APPROVED: 'Accepted for NoPay QR',
  REJECTED: 'Needs replacement',
};

const MAX_FILE_SIZE = MERCHANT_VERIFICATION_MAX_FILE_BYTES;
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function formatFileSize(sizeBytes: number) {
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MerchantVerificationForm() {
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [businessType, setBusinessType] = useState<MerchantVerificationBusinessType | ''>('');
  const [documentType, setDocumentType] = useState<MerchantVerificationDocumentType>('GST_CERTIFICATE');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadVerification = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/merchant/verification', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load shop verification details.');
      }
      const loaded = data.verification as VerificationData;
      setVerification(loaded);
      setBusinessType(loaded.businessType);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load shop verification details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVerification();
  }, [loadVerification]);

  const saveBusinessDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSavingDetails(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/merchant/verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalBusinessName: formData.get('legalBusinessName'),
          businessType: formData.get('businessType'),
          gstin: formData.get('gstin'),
          businessAddress: formData.get('businessAddress'),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not save shop details.');
      }
      setVerification(data.verification);
      setNotice('Shop details saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save shop details.');
    } finally {
      setSavingDetails(false);
    }
  };

  const uploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    if (!file) {
      setError('Choose a PDF, JPEG, or PNG document to upload.');
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError('Only PDF, JPEG, and PNG files are accepted.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      setError('Choose a non-empty file no larger than 10 MB.');
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const uploadForm = new FormData();
      uploadForm.append('documentType', documentType);
      uploadForm.append('file', file, file.name);
      const uploadResponse = await fetch('/api/merchant/verification/documents/upload', {
        method: 'POST',
        body: uploadForm,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || 'Could not upload the private document.');
      }

      setFile(null);
      if (fileInput) fileInput.value = '';
      setNotice('Document securely uploaded. It has not been verified yet.');
      await loadVerification();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the document.');
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (documentId: string) => {
    setDeletingDocumentId(documentId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/merchant/verification/documents/${encodeURIComponent(documentId)}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not remove the uploaded document.');
      }
      setNotice('Document removed from private storage.');
      await loadVerification();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not remove the uploaded document.');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-xs font-bold text-slate-400">Loading shop verification...</div>;
  }

  if (!verification) {
    return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error || 'Shop verification details are unavailable.'}</p>;
  }

  const statusLabel = verification.status.replaceAll('_', ' ');

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
          <div>
            <h2 className="text-lg font-black text-navy-900">Shop verification</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Add your shop details and upload at least one supporting document to enable NoPay QR records.
            </p>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          {verification.status === 'VERIFIED' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : verification.status === 'NEEDS_CHANGES' ? (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-slate-500" />
          )}
          <span className="font-bold">Status: {verification.status === 'VERIFIED' ? 'QR records enabled' : statusLabel}</span>
          {verification.submittedAt && (
            <span className="text-slate-500">· Submitted {new Date(verification.submittedAt).toLocaleDateString()}</span>
          )}
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

        <form onSubmit={saveBusinessDetails} className="space-y-4">
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            Legal business / owner name
            <input
              name="legalBusinessName"
              required
              minLength={2}
              maxLength={200}
              defaultValue={verification.legalBusinessName}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            Business structure
            <select
              name="businessType"
              required
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value as MerchantVerificationBusinessType)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="" disabled>Select business structure</option>
              {MERCHANT_VERIFICATION_BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>{BUSINESS_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            GSTIN <span className="font-normal text-slate-500">(optional if not GST-registered)</span>
            <input
              name="gstin"
              maxLength={15}
              defaultValue={verification.gstin}
              placeholder="15-character GSTIN"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            Registered business address
            <textarea
              name="businessAddress"
              required
              minLength={5}
              maxLength={500}
              defaultValue={verification.businessAddress}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={savingDetails}
            className="w-full rounded-xl bg-navy-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {savingDetails ? 'Saving details...' : 'Save shop details'}
          </button>
        </form>
      </section>

      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-navy-900">Supporting documents</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Commonly requested records may include a PAN document, shop/trade licence, address proof,
            business registration, and owner or authorised representative ID. Exact requirements depend
            on the business and applicable rules; upload only documents you are authorised to share.
            A GST certificate is relevant when GST-registered.
          </p>
        </div>

        <form onSubmit={uploadDocument} className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            Document category
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as MerchantVerificationDocumentType)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              {MERCHANT_VERIFICATION_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>{MERCHANT_VERIFICATION_DOCUMENT_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            Choose file
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-bold"
            />
            <span className="block font-normal text-slate-500">PDF, JPG, or PNG · up to 10 MB</span>
          </label>
          <p className="text-[11px] text-slate-500">
            Save the legal name, business structure, and registered address before uploading documents.
          </p>
          <button
            type="submit"
            disabled={
              uploading ||
              !file ||
              !verification.legalBusinessName ||
              !verification.businessType ||
              !verification.businessAddress
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading securely...' : 'Upload document'}
          </button>
        </form>

        {verification.documents.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {verification.documents.map((document) => (
              <div key={document.documentId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-navy-900">
                    {MERCHANT_VERIFICATION_DOCUMENT_LABELS[document.documentType]}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {document.fileName} · {formatFileSize(document.sizeBytes)}
                  </p>
                  <p className="text-[11px] font-semibold text-amber-700">
                    {DOCUMENT_STATUS_LABELS[document.status]}
                    {document.uploadedAt ? ` · ${new Date(document.uploadedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                {document.status !== 'UPLOADING' && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/merchant/verification/documents/${encodeURIComponent(document.documentId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </a>
                    <button
                      type="button"
                      disabled={deletingDocumentId === document.documentId}
                      onClick={() => void removeDocument(document.documentId)}
                      className="rounded-lg px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {deletingDocumentId === document.documentId ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                )}
                {document.status === 'UPLOADING' && (
                  <button
                    type="button"
                    disabled={deletingDocumentId === document.documentId}
                    onClick={() => void removeDocument(document.documentId)}
                    className="rounded-lg px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingDocumentId === document.documentId ? 'Removing...' : 'Remove incomplete upload'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
            No documents uploaded yet.
          </p>
        )}

        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
          Files are stored privately. In this web setup, submitting a document enables NoPay QR transaction records;
          it does not independently verify the shop or transfer real money. Real payment processing is not enabled by this step.
        </p>
      </section>
    </div>
  );
}
