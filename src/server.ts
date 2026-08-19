import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { app as apiApp } from './server-api.js';
import { startWhatsApp } from './services/whatsapp.js';
import { checkFirestoreReady } from './database/firebase.js';
import { config } from './config/index.js';

async function bootstrap() {
  await checkFirestoreReady();

  // Ensure data and log directories exist for persistent storage on VPS / Render
  try {
    const dataDir = path.resolve(config.bot.whatsappSessionDir);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (e) {
    console.warn('Failed to initialize persistent directories:', e);
  }

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : (config.bot.port || 3000);

  // Root Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Mount API endpoints from server-api
  app.use((req, res, next) => {
    console.log(`[Main Server] Request: ${req.method} ${req.url}`);
    next();
  });
  app.use(apiApp);

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

  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log('Starting WhatsApp bot...');
    try {
      await startWhatsApp();
    } catch (error) {
      console.error('Failed to start WhatsApp bot:', error);
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    // Force close after 10s if connections hang
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
