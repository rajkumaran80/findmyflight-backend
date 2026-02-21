import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

/**
 * Cache Service using Redis
 * Stores flight search results to reduce API calls
 */
@Injectable()
export class CacheService {
  private redisClient: RedisClientType | null = null;
  private isConnected = false;

  constructor() {
    if (process.env.CACHE_ENABLED === 'false') {
      console.log('Cache disabled via CACHE_ENABLED=false');
      return;
    }
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisPort = parseInt(process.env.REDIS_PORT || '6379');
      this.redisClient = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: redisPort,
          tls: redisPort === 6380,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis: Max reconnection retries exceeded');
              return new Error('Redis reconnection failed');
            }
            return Math.min(retries * 50, 500);
          },
        },
        password: process.env.REDIS_PASSWORD,
      });

      await this.redisClient.connect();
      this.isConnected = true;
      console.log('Redis cache connected');
    } catch (error) {
      console.warn('Failed to connect to Redis, cache disabled:', error);
      this.isConnected = false;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.redisClient) {
      return null;
    }

    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 600): Promise<void> {
    if (!this.isConnected || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    if (!this.isConnected || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.isConnected || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.flushDb();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Check if Redis is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.isConnected = false;
    }
  }
}
