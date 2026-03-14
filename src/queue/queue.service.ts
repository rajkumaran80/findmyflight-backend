import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AttractionJobData } from '../common/types/attraction.types';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue;

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '3', 10);

    this.queue = new Queue('attraction-generation', {
      connection: this.parseRedisUrl(redisUrl),
    });

    console.log(`[QUEUE] Queue initialized: attraction-generation (concurrency: ${concurrency})`);
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
      console.log('[QUEUE] Queue closed');
    }
  }

  async addGenerationJob(jobData: AttractionJobData): Promise<void> {
    const retryAttempts = parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3', 10);

    await this.queue.add('generate-attraction', jobData, {
      attempts: retryAttempts,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    });

    console.log(`[QUEUE] Job added: ${jobData.attractionName}`);
  }

  async getQueueMetrics() {
    return {
      waiting: await this.queue.getWaitingCount(),
      active: await this.queue.getActiveCount(),
      completed: await this.queue.getCompletedCount(),
      failed: await this.queue.getFailedCount(),
    };
  }

  private parseRedisUrl(url: string): { host: string; port: number; password?: string; tls?: object } {
    try {
      const parsed = new URL(url);
      const tls = parsed.protocol === 'rediss:' ? {} : undefined;
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        ...(tls && { tls }),
      };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }
}
