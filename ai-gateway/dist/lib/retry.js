"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryDelay = exports.sleep = void 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sleep = sleep;
const retryDelay = (attempt) => 300 * Math.pow(2, attempt);
exports.retryDelay = retryDelay;
