const { createClient } = require('redis');
require('dotenv').config();

let client = null;

if (process.env.REDIS_URL) {
  client = createClient({
    url: process.env.REDIS_URL,
  });

  client.on('error', (err) => console.error('Redis Client Error', err));
}

const connectRedis = async () => {
  if (client && !client.isOpen) {
    await client.connect();
  }
};

module.exports = {
  client,
  connectRedis,
  isRedisAvailable: () => !!process.env.REDIS_URL,
};
