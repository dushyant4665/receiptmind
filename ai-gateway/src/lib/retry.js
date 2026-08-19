const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Exponential backoff: 300ms, 600ms, 1200ms...
const retryDelay = (attempt) => 300 * Math.pow(2, attempt);

module.exports = { sleep, retryDelay };
