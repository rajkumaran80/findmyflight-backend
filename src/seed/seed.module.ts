import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SeedController],
  providers: [SeedService, PrismaService],
})
export class SeedModule {}
