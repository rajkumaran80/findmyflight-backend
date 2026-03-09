import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueWorker } from './queue.worker';
import { QueueProcessor } from './queue.processor';
import { PrismaService } from '../prisma/prisma.service';
import { ContentGeneratorModule } from '../content/content-generator.module';
import { ImageModule } from '../images/image.module';
import { RevalidationModule } from '../revalidation/revalidation.module';

@Module({
  imports: [ContentGeneratorModule, ImageModule, RevalidationModule],
  providers: [QueueService, QueueWorker, QueueProcessor, PrismaService],
  exports: [QueueService],
})
export class QueueModule {}
