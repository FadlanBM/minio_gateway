import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fileRoutes from './routes/fileRoutes.js';
import { ensureBucketExists } from './config/minio.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients (including Flutter Web)
app.use(cors());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static info page or health check
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'MinIO Promilku API Bridge is running.',
    endpoints: {
      uploadDirect: 'POST /api/files/upload (Multipart file)',
      presignedUploadUrl: 'GET /api/files/presigned-upload-url?filename=test.png&contentType=image/png',
      presignedDownloadUrl: 'GET /api/files/presigned-download-url?objectName=test.png',
      list: 'GET /api/files/list',
      delete: 'DELETE /api/files/delete?objectName=test.png'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Register file routes
app.use('/api/files', fileRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[App Error]:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Initialize server after ensuring default bucket exists
const startServer = async () => {
  try {
    console.log('[MinIO] Bootstrapping bucket status...');
    await ensureBucketExists();
    
    app.listen(PORT, () => {
      console.log(`[Server] Bridge running on port ${PORT}`);
      console.log(`[Server] API available at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Initialization failed. MinIO might be offline:', error.message);
    process.exit(1);
  }
};

startServer();
