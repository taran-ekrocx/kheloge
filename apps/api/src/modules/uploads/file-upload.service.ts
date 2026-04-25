import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type UploadFolder = 'photos' | 'id-cards' | 'invoices';

const ALLOWED_MIME: Record<UploadFolder, string[]> = {
  photos: ['image/jpeg', 'image/png', 'image/webp'],
  'id-cards': ['application/pdf'],
  invoices: ['application/pdf'],
};

const MAX_BYTES: Record<UploadFolder, number> = {
  photos: 5 * 1024 * 1024,      // 5 MB
  'id-cards': 10 * 1024 * 1024, // 10 MB
  invoices: 10 * 1024 * 1024,   // 10 MB
};

@Injectable()
export class FileUploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private config: ConfigService) {
    const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucket = this.config.getOrThrow<string>('R2_BUCKET');
    this.publicBaseUrl = this.config.get<string>('R2_PUBLIC_URL', '').replace(/\/$/, '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * Upload a Buffer directly to R2.
   * Returns the public URL of the uploaded file.
   */
  async upload(
    folder: UploadFolder,
    fileName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    this.validate(folder, mimeType, buffer.byteLength);

    const key = `${folder}/${fileName}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // R2 public bucket serves objects at the public base URL
      }),
    );

    return this.publicUrl(key);
  }

  /**
   * Upload from a multipart form-data stream (Fastify/Busboy).
   * Accumulates the stream into a Buffer then calls upload().
   */
  async uploadStream(
    folder: UploadFolder,
    fileName: string,
    stream: NodeJS.ReadableStream,
    mimeType: string,
  ): Promise<string> {
    const buffer = await this.streamToBuffer(stream);
    return this.upload(folder, fileName, buffer, mimeType);
  }

  /**
   * Delete an object by its full public URL or storage key.
   */
  async delete(urlOrKey: string): Promise<void> {
    const key = this.toKey(urlOrKey);
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Generate a short-lived presigned URL for private reads (expiry defaults to 1 hour).
   */
  async presignedGetUrl(urlOrKey: string, expiresIn = 3600): Promise<string> {
    const key = this.toKey(urlOrKey);
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private validate(folder: UploadFolder, mimeType: string, bytes: number) {
    if (!ALLOWED_MIME[folder].includes(mimeType)) {
      throw new BadRequestException(
        `Unsupported file type "${mimeType}" for folder "${folder}". Allowed: ${ALLOWED_MIME[folder].join(', ')}`,
      );
    }
    if (bytes > MAX_BYTES[folder]) {
      const limitMb = MAX_BYTES[folder] / 1024 / 1024;
      throw new BadRequestException(`File exceeds ${limitMb} MB limit for folder "${folder}"`);
    }
  }

  private publicUrl(key: string): string {
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${key}`;
    // Fallback: R2 workers.dev URL (useful in dev without a custom domain)
    return `https://${this.bucket}.${this.config.get('R2_ACCOUNT_ID')}.r2.dev/${key}`;
  }

  private toKey(urlOrKey: string): string {
    if (urlOrKey.startsWith('http')) {
      const url = new URL(urlOrKey);
      // Strip leading slash
      return url.pathname.slice(1);
    }
    return urlOrKey;
  }

  private streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
