import { finished } from 'node:stream/promises';
import mongoose from 'mongoose';
import { MERCHANT_VERIFICATION_MAX_FILE_BYTES } from '@/lib/merchant/verification';

const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
type AllowedDocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number];
const BUCKET_NAME = 'merchantVerificationDocuments';

function getPrivateDocumentBucket() {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error('MongoDB must be connected before accessing private documents.');
  }
  return new mongoose.mongo.GridFSBucket(database, { bucketName: BUCKET_NAME });
}

export function verifyPrivateDocumentContent(contentType: AllowedDocumentType, bytes: Uint8Array) {
  if (bytes.length === 0 || bytes.length > MERCHANT_VERIFICATION_MAX_FILE_BYTES) {
    return false;
  }
  if (contentType === 'application/pdf') {
    return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
  }
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

export async function savePrivateDocument(
  fileName: string,
  contentType: AllowedDocumentType,
  bytes: Buffer
) {
  const id = new mongoose.mongo.ObjectId();
  const uploadStream = getPrivateDocumentBucket().openUploadStreamWithId(id, fileName, {
    contentType,
    metadata: { private: true },
  });
  const uploadFinished = finished(uploadStream);
  uploadStream.end(bytes);
  await uploadFinished;
  return id.toHexString();
}

function parseStorageKey(storageKey: string) {
  if (!mongoose.mongo.ObjectId.isValid(storageKey)) {
    throw new Error('Private document reference is invalid.');
  }
  return new mongoose.mongo.ObjectId(storageKey);
}

export function createPrivateDocumentReadStream(storageKey: string) {
  const downloadStream = getPrivateDocumentBucket().openDownloadStream(parseStorageKey(storageKey));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      downloadStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      downloadStream.on('error', (error: Error) => controller.error(error));
      downloadStream.on('end', () => controller.close());
    },
    cancel() {
      downloadStream.destroy();
    },
  });
}

export async function deletePrivateDocument(storageKey: string) {
  await getPrivateDocumentBucket().delete(parseStorageKey(storageKey));
}
