import app from './app';
import { env } from './config/env';

const server = app.listen(env.port, () => {
  console.log(`AI Gateway listening on port ${env.port}`);
});

const shutdown = async () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
