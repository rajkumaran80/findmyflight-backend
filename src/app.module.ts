import { Module } from '@nestjs/common';
import { FlightsModule } from './flights/flights.module';
import { AttractionsModule } from './attractions/attractions.module';
import { QueueModule } from './queue/queue.module';
import { ContentGeneratorModule } from './content/content-generator.module';
import { ImageModule } from './images/image.module';
import { RevalidationModule } from './revalidation/revalidation.module';

@Module({
  imports: [
    FlightsModule,
    AttractionsModule,
    QueueModule,
    ContentGeneratorModule,
    ImageModule,
    RevalidationModule,
  ],
})
export class AppModule {}
