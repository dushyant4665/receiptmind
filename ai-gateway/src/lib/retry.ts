export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const retryDelay = (attempt: number) =>
  300 * Math.pow(2, attempt);

