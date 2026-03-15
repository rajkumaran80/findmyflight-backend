import { Controller, Get, Param, Query, Header, BadRequestException } from '@nestjs/common';
import { AirportsService } from './airports.service';

@Controller('api/airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('nearest')
  @Header('Cache-Control', 'public, max-age=300, s-maxage=3600')
  async findNearest(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) throw new BadRequestException('lat and lng are required');
    const results = await this.airportsService.findNearest(latNum, lngNum, 1);
    return results[0] ?? null;
  }

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
