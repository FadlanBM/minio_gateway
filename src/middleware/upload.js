import multer from 'multer';

// Use memory storage to avoid writing file to disk locally on the API server.
// The file is held in a buffer, and then streamed directly to MinIO.
const storage = multer.memoryStorage();

// Set limits (e.g. 50MB file size limits)
const limits = {
  fileSize: 50 * 1024 * 1024, // 50 MB limit
};

// Create the multer instance
export const upload = multer({
  storage: storage,
  limits: limits
});
