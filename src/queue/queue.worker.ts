import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { AttractionJobData } from '../common/types/attraction.types';
import { QueueProcessor } from './queue.processor';

@Injectable()
export class QueueWorker implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker;

  constructor(private readonly processor: QueueProcessor) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '3', 10);

    this.worker = new Worker(
      'attraction-generation',
      async (job: Job<AttractionJobData>) => {
        await this.processor.processGenerationJob(job);
      },
      {
        connection: this.parseRedisUrl(redisUrl),
        concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`[WORKER] Job completed: ${job.id} - ${job.data.attractionName}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[WORKER] Job failed: ${job?.id} - ${err.message}`);
    });

    this.worker.on('error', (err) => {
      console.error('[WORKER] Worker error:', err.message);
    });

    console.log(`[WORKER] Started with concurrency: ${concurrency}`);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      console.log('[WORKER] Closed');
    }
  }

  private parseRedisUrl(url: string): { host: string; port: number; password?: string; tls?: object } {
    try {
      const parsed = new URL(url);
      const tls = parsed.protocol === 'rediss:' ? {} : undefined;
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password || undefined,
        ...(tls && { tls }),
      };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }
}
