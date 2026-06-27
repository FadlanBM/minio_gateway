import { minioClient, defaultBucket, ensureBucketExists } from '../config/minio.js';
import path from 'path';

/**
 * Helper to get bucket name from request or default
 */
const getBucket = (req) => {
  return req.body?.bucket || req.query?.bucket || defaultBucket;
};

/**
 * Controller to upload file directly through the API
 */
export const uploadFileDirectly = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const bucket = getBucket(req);
    await ensureBucketExists(bucket);

    const originalName = req.file.originalname;
    const fileExtension = path.extname(originalName);
    
    // Generate unique name or use specified key
    const customPath = req.body.path ? req.body.path.replace(/^\/+|\/+$/g, '') : ''; // e.g. "avatars/users"
    const randomSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileName = req.body.filename || `${randomSuffix}${fileExtension}`;
    const objectName = customPath ? `${customPath}/${fileName}` : fileName;

    const metaData = {
      'Content-Type': req.file.mimetype,
    };

    // Upload buffer to MinIO
    await minioClient.putObject(
      bucket,
      objectName,
      req.file.buffer,
      req.file.size,
      metaData
    );

    // Generate a temporary view link (valid for 24 hours) for convenience
    const tempUrl = await minioClient.presignedGetObject(bucket, objectName, 24 * 60 * 60);

    return res.status(201).json({
      message: 'File uploaded successfully',
      bucket,
      objectName,
      originalName,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url: tempUrl // Expose view URL
    });
  } catch (error) {
    console.error('Error in uploadFileDirectly:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to generate presigned PUT URL
 * Flutter frontend will use this to upload files directly to MinIO
 */
export const getPresignedUploadUrl = async (req, res) => {
  try {
    const { filename, contentType, path: folderPath } = req.query;

    if (!filename) {
      return res.status(400).json({ error: 'filename query parameter is required' });
    }

    const bucket = getBucket(req);
    await ensureBucketExists(bucket);

    const fileExtension = path.extname(filename);
    const randomSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const uniqueFileName = `${randomSuffix}${fileExtension}`;
    const cleanFolder = folderPath ? folderPath.replace(/^\/+|\/+$/g, '') : '';
    const objectName = cleanFolder ? `${cleanFolder}/${uniqueFileName}` : uniqueFileName;

    // Default expiry 15 minutes (900 seconds)
    const expiry = parseInt(req.query.expiry, 10) || 15 * 60; 

    // Generate presigned PUT URL
    const uploadUrl = await minioClient.presignedPutObject(bucket, objectName, expiry);

    return res.status(200).json({
      uploadUrl,
      objectName,
      bucket,
      expirySeconds: expiry,
      headers: {
        'Content-Type': contentType || 'application/octet-stream'
      }
    });
  } catch (error) {
    console.error('Error in getPresignedUploadUrl:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to generate presigned GET URL to view or download a private file
 */
export const getPresignedDownloadUrl = async (req, res) => {
  try {
    const { objectName } = req.query;

    if (!objectName) {
      return res.status(400).json({ error: 'objectName query parameter is required' });
    }

    const bucket = getBucket(req);
    
    // Default expiry 24 hours (86400 seconds)
    const expiry = parseInt(req.query.expiry, 10) || 24 * 60 * 60;

    const downloadUrl = await minioClient.presignedGetObject(bucket, objectName, expiry);

    return res.status(200).json({
      downloadUrl,
      objectName,
      bucket,
      expirySeconds: expiry
    });
  } catch (error) {
    console.error('Error in getPresignedDownloadUrl:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to list objects in a bucket
 */
export const listObjects = async (req, res) => {
  try {
    const bucket = getBucket(req);
    const prefix = req.query.prefix || '';
    const recursive = req.query.recursive === 'true';

    // Verify bucket exists first
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      return res.status(404).json({ error: `Bucket "${bucket}" does not exist` });
    }

    const stream = minioClient.listObjectsV2(bucket, prefix, recursive);
    const objects = [];

    stream.on('data', (obj) => {
      objects.push(obj);
    });

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      // Avoid double-headers sent in case of mid-stream errors by checking headersSent
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    stream.on('end', () => {
      if (!res.headersSent) {
        return res.status(200).json({
          bucket,
          prefix,
          recursive,
          count: objects.length,
          objects
        });
      }
    });
  } catch (error) {
    console.error('Error in listObjects:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
  }
};

/**
 * Controller to delete an object
 */
export const deleteObject = async (req, res) => {
  try {
    // Check both body and query params
    const objectName = req.body.objectName || req.query.objectName;

    if (!objectName) {
      return res.status(400).json({ error: 'objectName is required in request body or query parameter' });
    }

    const bucket = getBucket(req);

    await minioClient.removeObject(bucket, objectName);

    return res.status(200).json({
      message: 'Object deleted successfully',
      bucket,
      objectName
    });
  } catch (error) {
    console.error('Error in deleteObject:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to directly serve/download a file from MinIO through the API.
 * Use: GET /api/files/{objectName}
 */
export const getFileDirectly = async (req, res) => {
  try {
    const bucket = getBucket(req);
    // Path set by catch-all middleware in routes
    const objectName = req.rawObjectPath || decodeURIComponent(req.path.replace(/^\//, ''));
    
    if (!objectName) {
      return res.status(400).json({ error: 'No file path provided' });
    }

    // Get object stats for Content-Type and Content-Length
    const stat = await minioClient.statObject(bucket, objectName);

    res.set({
      'Content-Type': stat.metaData?.['content-type'] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `inline; filename="${path.basename(objectName)}"`,
      'Cache-Control': 'public, max-age=3600',
      'ETag': stat.etag,
      'Last-Modified': stat.lastModified?.toUTCString() || ''
    });

    // Stream the file from MinIO directly to response
    const stream = await minioClient.getObject(bucket, objectName);

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error('Error in getFileDirectly:', error);
    // Not found or other errors
    const status = error.code === 'NoSuchKey' ? 404 : 500;
    return res.status(status).json({ error: error.message || 'File not found' });
  }
};
