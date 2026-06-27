import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import {
  uploadFileDirectly,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  listObjects,
  deleteObject,
  getFileDirectly
} from '../controllers/fileController.js';

const router = Router();

// Route for proxy upload through Express API
router.post('/upload', upload.single('file'), uploadFileDirectly);

// Route for generating direct upload URLs (Presigned PUT)
router.get('/presigned-upload-url', getPresignedUploadUrl);

// Route for generating download/view URLs (Presigned GET)
router.get('/presigned-download-url', getPresignedDownloadUrl);

// Route to list objects
router.get('/list', listObjects);

// Route to delete an object (supports DELETE with JSON body or query param)
router.delete('/delete', deleteObject);

// Catch-all middleware: serve/download files directly via path
// Example: GET /api/files/folder/my-image.png
// Uses manual path extraction instead of path-to-regexp wildcard
router.use((req, res, next) => {
  // Only handle GET requests, forward others
  if (req.method !== 'GET') return next();
  
  // Pass path info to controller via request property
  req.rawObjectPath = decodeURIComponent(req.path.replace(/^\//, ''));
  if (!req.rawObjectPath) return next();
  
  return getFileDirectly(req, res);
});

export default router;
