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

// Wildcard route: serve/download files directly via path
// Example: GET /api/files/folder/my-image.png
// Must be registered LAST to avoid overriding named routes above
router.get('/:objectName(*)', getFileDirectly);

export default router;
