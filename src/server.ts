import express from 'express';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { config } from './config/index.js';
import { startWhatsApp } from './services/whatsapp.js';

async function bootstrap() {
  const app = express();
  const PORT = config.bot.port || 3000;

  app.use(helmet({
    contentSecurityPolicy: false, // Disable for Vite development
  }));
  app.use(express.json());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  });
  app.use(limiter);

  // API Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'Online (Bot Running)' });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Starting WhatsApp bot...');
    try {
      await startWhatsApp();
    } catch (error) {
      console.error('Failed to start WhatsApp bot:', error);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
  });
}

bootstrap();
