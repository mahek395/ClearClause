// src/config/redis.js
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck:     false,
});

redisConnection.on('connect', () => console.log('✅ Redis connected'));
redisConnection.on('error',   (err) => console.error('❌ Redis error:', err.message));

export default redisConnection;