import { Module } from '@nestjs/common';
import { AirportsController } from './airports.controller';
import { AirportsService } from './airports.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AirportsController],
  providers: [AirportsService, PrismaService],
})
export class AirportsModule {}
