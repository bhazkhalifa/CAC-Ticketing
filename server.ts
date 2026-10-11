import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

const distPath = path.resolve(__dirname, 'dist');
const indexPath = path.resolve(distPath, 'index.html');

// Ensure build exists before serving
if (!fs.existsSync(indexPath)) {
  console.log('dist/index.html not found, generating production build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to run npm run build:', err);
  }
}

// Serve static files from the dist folder
app.use(express.static(distPath));

// Health check endpoint for Cloud Run container probes
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// SPA fallback for client-side navigation
app.get('*', (_req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send('Application build in progress. Please refresh shortly.');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
