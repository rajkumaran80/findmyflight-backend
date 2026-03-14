import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('api/admin')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('seed')
  async seed(@Headers('x-api-secret') secret: string) {
    if (!secret || secret !== process.env.API_SECRET) {
      throw new UnauthorizedException();
    }
    return this.seedService.seedAll();
  }
}
