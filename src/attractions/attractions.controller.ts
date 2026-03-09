import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AttractionsService } from './attractions.service';
import { ApiSecretGuard } from '../common/guards/api-secret.guard';

@Controller('api/attractions')
export class AttractionsController {
  constructor(private readonly attractionsService: AttractionsService) {}

  // --- Lookup endpoints for admin dropdowns ---

  @Get('countries')
  async getCountries() {
    return this.attractionsService.getAllCountries();
  }

  @Get('countries/:code/cities')
  async getCities(@Param('code') code: string) {
    return this.attractionsService.getCitiesByCountry(code.toUpperCase());
  }

  // --- Attraction CRUD ---

  @Get('list')
  async listAttractions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('countryCode') countryCode?: string,
  ) {
    if (page || pageSize || search || status || countryCode) {
      return this.attractionsService.getAttractionsPaginated({
        page: parseInt(page || '1', 10),
        pageSize: parseInt(pageSize || '20', 10),
        search,
        status,
        countryCode,
      });
    }
    return this.attractionsService.getAllAttractions();
  }

  @Get('summary')
  async getStatusSummary() {
    return this.attractionsService.getStatusSummary();
  }

  @Post('import-json')
  @HttpCode(200)
  async importFromJson() {
    return this.attractionsService.importFromJsonFile();
  }

  @Post('create')
  async createAttraction(
    @Body() body: { name: string; countryCode: string; city: string; latitude?: number; longitude?: number },
  ) {
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return this.attractionsService.createAttraction({
      name: body.name,
      countryCode: body.countryCode,
      city: body.city,
      slug,
      latitude: body.latitude,
      longitude: body.longitude,
    });
  }

  // --- Public page data endpoints ---

  @Get('page/:slug')
  async getAttractionPage(@Param('slug') slug: string) {
    const page = await this.attractionsService.getAttractionBySlug(slug);
    if (!page) {
      throw new NotFoundException(`Attraction not found: ${slug}`);
    }
    return page;
  }

  @Get('pages')
  async getAllAttractionPages() {
    return this.attractionsService.getAllCompletedAttractions();
  }

  // --- Generation endpoints ---

  @Post('generate/:id')
  @HttpCode(202)
  async generate(@Param('id') id: string) {
    await this.attractionsService.triggerGeneration(id);
    return { message: 'Generation job queued successfully', attractionId: id };
  }

  @Post('regenerate/:id')
  @UseGuards(ApiSecretGuard)
  @HttpCode(202)
  async regenerate(@Param('id') id: string) {
    await this.attractionsService.triggerRegeneration(id);
    return { message: 'Regeneration job queued successfully', attractionId: id };
  }

  @Get('status/:id')
  async getStatus(@Param('id') id: string) {
    const status = await this.attractionsService.getGenerationStatus(id);
    if (!status) {
      throw new NotFoundException(`Attraction with id ${id} not found`);
    }
    return status;
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'attractions',
      timestamp: new Date().toISOString(),
    };
  }

  // --- Edit / Update endpoints ---

  @Delete('photos/:photoId')
  async deletePhoto(@Param('photoId') photoId: string) {
    await this.attractionsService.deletePhoto(photoId);
    return { message: 'Photo deleted' };
  }

  @Put('photos/reorder')
  async reorderPhotos(
    @Body() body: { attractionId: string; photoIds: string[] },
  ) {
    await this.attractionsService.reorderPhotos(body.attractionId, body.photoIds);
    return { message: 'Photos reordered' };
  }

  @Get(':id')
  async getAttraction(@Param('id') id: string) {
    return this.attractionsService.getAttractionById(id);
  }

  @Put(':id')
  async updateAttraction(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      seoTitle?: string;
      metaDescription?: string;
      contentHtml?: string;
      bestTimeToVisit?: string;
      entryFee?: string;
    },
  ) {
    return this.attractionsService.updateAttraction(id, body);
  }

  @Post(':id/photos')
  async addPhoto(
    @Param('id') id: string,
    @Body() body: { imageUrl: string; altText: string; source?: string },
  ) {
    return this.attractionsService.addPhoto(id, body);
  }
}
