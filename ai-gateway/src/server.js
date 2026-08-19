require('dotenv').config();
const app = require('./app');
const { env } = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`AI Gateway running on port ${env.port}`);
  console.log(`OpenRouter: ${env.openRouterApiKey ? 'configured' : 'NOT SET'}`);
  console.log(`Gemini: ${env.geminiApiKey ? 'configured' : 'NOT SET'}`);
});

const shutdown = () => {
  console.log('Shutting down AI Gateway...');
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
