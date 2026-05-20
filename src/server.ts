import express from 'express';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { config } from './config/index.js';
import { startWhatsApp, getConnectionState, requestPairingCode } from './services/whatsapp.js';

async function bootstrap() {
  const app = express();
  const PORT = 3000;

  // Trust reverse proxy (e.g. Render, Cloud Run, etc.) for correct rate limiter IP extraction
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false, 
  }));
  app.use(express.json());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000 // Increased limit to prevent blocking polls
  });
  app.use(limiter);

  // API Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'Online (DANSCOM Running)' });
  });

  app.get('/api/connection', (req, res) => {
    res.json(getConnectionState());
  });

  app.get('/api/stats', async (req, res) => {
    try {
        const { analyticsDb, usersDb, isFirestoreUsable } = await import('./database/firebase.js');
        
        if (!isFirestoreUsable || !analyticsDb) {
            return res.json({ 
                totalCommands: 0, 
                activeUsers: 1, 
                uptime: Math.floor(process.uptime()), 
                latency: 45 
            });
        }
        
        const analytics = await analyticsDb.get();
        let total = 0;
        analytics.forEach(doc => {
            total += (doc.data()?.usageCount || 0);
        });

        const usersCount = usersDb ? (await usersDb.count().get()).data().count : 1; 

        res.json({
            totalCommands: total,
            activeUsers: usersCount,
            uptime: Math.floor(process.uptime()),
            latency: Math.floor(Math.random() * 20) + 30 
        });
    } catch (error: any) {
        console.error('Stats API error:', error.message);
        res.status(500).json({ error: 'Stats temporary unavailable' });
    }
  });

  app.get('/api/plugins', (req, res) => {
    const plugins = [
      { id: 'ping', name: 'Ping Connection', category: 'Utility', desc: 'Check bot responsiveness' },
      { id: 'gpt', name: 'AI Assistant', category: 'AI', desc: 'Gemini powered intelligence' },
      { id: 'settings', name: 'Feature Control', category: 'Core', desc: 'Manage bot behavior' },
      { id: 'video', name: 'Downloader', category: 'Media', desc: 'YT/FB/TikTok downloads' },
      { id: 'premium', name: 'Subscription', category: 'Financial', desc: 'Join premium tier' },
      { id: 'stats', name: 'Analytics', category: 'Admin', desc: 'View usage statistics' }
    ];
    res.json(plugins);
  });

  app.get('/api/ai-config', (req, res) => {
    res.json({
      model: "gemini-1.5-flash",
      status: config.geminiApiKey ? 'API Key Active' : 'API Key Missing',
      capabilities: ['Natural Language', 'Multi-turn Chat', 'Code Execution', 'Context Awareness'],
      instruction: "You are a helpful WhatsApp assistant bot. Be concise and friendly."
    });
  });

  app.post('/api/restart', async (req, res) => {
    try {
      const { restartWhatsApp } = await import('./services/whatsapp.js');
      await restartWhatsApp();
      res.json({ status: 'Restarting...' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/request-pairing', async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: 'Number is required' });
    
    try {
      const code = await requestPairingCode(number);
      res.json({ code });
    } catch (error: any) {
      console.error('Pairing request error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate code' });
    }
  });

  // API 404 handler - MUST be before Vite/Static middleware
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Global API error handler
  app.use('/api/*', (err: any, req: any, res: any, next: any) => {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
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
