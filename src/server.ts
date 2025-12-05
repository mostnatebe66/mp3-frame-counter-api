import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer, { memoryStorage, MulterError } from 'multer';

import { countMp3Frames, FrameCounterError } from './frame-counter.service';

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({
  storage: memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

app.post(
  '/file-upload',
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Use 'file' field in form-data." });
    }

    try {
      const buffer = req.file.buffer;
      const frameCount = countMp3Frames(buffer);

      res.setHeader('Content-Type', 'application/json');
      return res.json({ frameCount });
    } catch (err) {
      return next(err);
    }
  },
);

// api health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  if (err instanceof MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err instanceof FrameCounterError) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: 'Internal server error' });
});
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
