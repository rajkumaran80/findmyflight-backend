import { Module, Controller, Get } from '@nestjs/common';
import { FlightsModule } from './flights/flights.module';
import { AttractionsModule } from './attractions/attractions.module';
import { AirportsModule } from './airports/airports.module';
import { QueueModule } from './queue/queue.module';
import { ContentGeneratorModule } from './content/content-generator.module';
import { ImageModule } from './images/image.module';
import { RevalidationModule } from './revalidation/revalidation.module';
import { SeedModule } from './seed/seed.module';

@Controller('api')
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    FlightsModule,
    AttractionsModule,
    AirportsModule,
    QueueModule,
    ContentGeneratorModule,
    ImageModule,
    RevalidationModule,
    SeedModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
