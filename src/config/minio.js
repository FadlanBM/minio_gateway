import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const useSSL = process.env.MINIO_USE_SSL === 'true';
// Default ports: 9000 for standard, 443 for SSL, 80 for HTTP if port not defined
const portStr = process.env.MINIO_PORT;
const port = portStr ? parseInt(portStr, 10) : (useSSL ? 443 : 80);

console.log(`Initializing MinIO client targeting ${process.env.MINIO_ENDPOINT || 'localhost'}:${port} (SSL: ${useSSL})`);

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: port,
  useSSL: useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

export const defaultBucket = process.env.MINIO_DEFAULT_BUCKET || 'promilku';

/**
 * Ensures a bucket exists, creates it if not.
 * @param {string} bucketName 
 */
export const ensureBucketExists = async (bucketName = defaultBucket) => {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      // In MinIO client API, makeBucket can accept region as second argument (optional)
      await minioClient.makeBucket(bucketName, 'us-east-1');
      console.log(`[MinIO] Bucket "${bucketName}" did not exist and was created.`);
    } else {
      console.log(`[MinIO] Bucket "${bucketName}" verified exists.`);
    }
  } catch (error) {
    console.error(`[MinIO] Error ensuring bucket "${bucketName}" exists:`, error.message);
    throw error;
  }
};
