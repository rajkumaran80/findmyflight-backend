import { Module } from '@nestjs/common';
import { FlightSearchController } from './flights.controller';
import { FlightAggregatorService } from '../aggregator/flight-aggregator.service';
import { CacheService } from '../cache/cache.service';

@Module({
  controllers: [FlightSearchController],
  providers: [FlightAggregatorService, CacheService],
  exports: [FlightAggregatorService, CacheService],
})
export class FlightsModule {}
