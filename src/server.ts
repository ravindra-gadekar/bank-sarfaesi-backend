import { env } from './config/env';
import { connectDatabase } from './config/database';
import { initAgenda } from './config/agenda';
import { registerDocumentJobs } from './document/services/documentQueue.service';
import { seedChatFlows } from './chat-flow/seeds/seedRunner';
import app from './app';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  // Seed default chat flow configs if not present
  await seedChatFlows();

  // Initialize Agenda.js job queue and register job handlers
  const agenda = await initAgenda();
  registerDocumentJobs(agenda);

  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`📋 Health check: http://localhost:${env.PORT}/api/health`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
