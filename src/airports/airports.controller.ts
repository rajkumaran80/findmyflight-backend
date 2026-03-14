import { Controller, Get, Param, Query, Header } from '@nestjs/common';
import { AirportsService } from './airports.service';

@Controller('api/airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('search')
  @Header('Cache-Control', 'public, max-age=300, s-maxage=3600')
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.airportsService.search(q ?? '', limit ? parseInt(limit) : 20);
  }

  @Get('code/:code')
  @Header('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  async findByCode(@Param('code') code: string) {
    return this.airportsService.findByCode(code);
  }
}
