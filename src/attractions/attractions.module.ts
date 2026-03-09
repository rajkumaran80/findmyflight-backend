import { Module } from '@nestjs/common';
import { AttractionsController } from './attractions.controller';
import { AttractionsService } from './attractions.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueModule } from '../queue/queue.module';
import { RevalidationModule } from '../revalidation/revalidation.module';

@Module({
  imports: [QueueModule, RevalidationModule],
  controllers: [AttractionsController],
  providers: [AttractionsService, PrismaService],
  exports: [AttractionsService],
})
export class AttractionsModule {}
