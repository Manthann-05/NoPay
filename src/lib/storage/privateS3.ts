import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MERCHANT_VERIFICATION_MAX_FILE_BYTES } from '@/lib/merchant/verification';

const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
type AllowedDocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number];

let client: S3Client | undefined;

export class InvalidPrivateDocumentUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPrivateDocumentUploadError';
  }
}

function getPrivateBucketConfig() {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('Private document storage is not configured.');
  }

  return { bucket, region, accessKeyId, secretAccessKey, endpoint };
}

function getClient() {
  if (!client) {
    const config = getPrivateBucketConfig();
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: Boolean(config.endpoint),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return client;
}

export async function createPrivateDocumentUpload(storageKey: string, contentType: AllowedDocumentType) {
  const config = getPrivateBucketConfig();
  return createPresignedPost(getClient(), {
    Bucket: config.bucket,
    Key: storageKey,
    Expires: 300,
    Fields: { 'Content-Type': contentType },
    Conditions: [
      ['content-length-range', 1, MERCHANT_VERIFICATION_MAX_FILE_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
  });
}

function hasExpectedSignature(contentType: AllowedDocumentType, bytes: Uint8Array) {
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

export async function verifyPrivateDocumentUpload(
  storageKey: string,
  expectedContentType: AllowedDocumentType,
  expectedSizeBytes: number
) {
  const config = getPrivateBucketConfig();
  const s3 = getClient();
  const object = await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: storageKey }));

  if (
    !object.ContentLength ||
    object.ContentLength !== expectedSizeBytes ||
    object.ContentLength > MERCHANT_VERIFICATION_MAX_FILE_BYTES ||
    object.ContentType !== expectedContentType ||
    !ALLOWED_DOCUMENT_TYPES.includes(expectedContentType)
  ) {
    await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    throw new InvalidPrivateDocumentUploadError('Uploaded file size or type did not match the submission.');
  }

  const uploaded = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }));
  const bytes = await uploaded.Body?.transformToByteArray();
  if (!bytes || !hasExpectedSignature(expectedContentType, bytes)) {
    await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    throw new InvalidPrivateDocumentUploadError(
      'Uploaded file content is not a supported PDF, JPEG, or PNG document.'
    );
  }
}

export async function createPrivateDocumentDownload(storageKey: string, fileName: string) {
  const config = getPrivateBucketConfig();
  const safeFileName = fileName.replace(/[\r\n"\\]/g, '_').slice(0, 180) || 'document';
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${safeFileName}"`,
      ResponseContentType: 'application/octet-stream',
    }),
    { expiresIn: 60 }
  );
}

export async function deletePrivateDocument(storageKey: string) {
  const config = getPrivateBucketConfig();
  await getClient().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
}
