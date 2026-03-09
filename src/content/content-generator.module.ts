import { Module } from '@nestjs/common';
import { ContentGeneratorService } from './content-generator.service';

@Module({
  providers: [ContentGeneratorService],
  exports: [ContentGeneratorService],
})
export class ContentGeneratorModule {}
