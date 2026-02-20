import { Module } from '@nestjs/common';
import { FlightsModule } from './flights/flights.module';

@Module({
  imports: [FlightsModule],
})
export class AppModule {}
