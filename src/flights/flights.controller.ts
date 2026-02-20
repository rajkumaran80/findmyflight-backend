import { Controller, Post, Get, Body, Query, BadRequestException, HttpCode } from '@nestjs/common';
import { FlightAggregatorService } from '../aggregator/flight-aggregator.service';
import { FlightSearchDto, FlightFilterDto } from '../common/dto';
import { FlightSearchParams, FlightSearchResult } from '../common/types';
import { rankingEngine } from '../ranking/ranking.engine';

/**
 * Flight Search Controller
 * Handles all flight search-related API endpoints
 */
@Controller('api/flights')
export class FlightSearchController {
  constructor(private flightAggregatorService: FlightAggregatorService) {}

  /**
   * POST /api/flights/search
   * Search for flights
   */
  @Post('search')
  @HttpCode(200)
  async searchFlights(@Body() searchDto: FlightSearchDto): Promise<FlightSearchResult> {
    // Validate DTO
    const params: FlightSearchParams = {
      from: searchDto.from.toUpperCase(),
      to: searchDto.to.toUpperCase(),
      departDate: searchDto.departDate,
      returnDate: searchDto.returnDate,
      passengers: searchDto.passengers,
      tripType: searchDto.tripType,
      cabin: searchDto.cabin,
      maxPrice: searchDto.maxPrice,
      includeProviders: searchDto.includeProviders,
    };

    // Validate search parameters
    const validation = this.flightAggregatorService.validateSearchParams(params);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid search parameters',
        errors: validation.errors,
      });
    }

    // Perform search
    return this.flightAggregatorService.searchFlights(params);
  }

  /**
   * GET /api/flights/providers
   * Get list of available providers
   */
  @Get('providers')
  getProviders(): {
    providers: string[];
    count: number;
  } {
    const providers = this.flightAggregatorService.getProviders();
    return {
      providers,
      count: providers.length,
    };
  }

  /**
   * POST /api/flights/search/filter
   * Apply filters to existing search results
   * This is clientside, but can also be done server-side for consistency
   */
  @Post('filter')
  @HttpCode(200)
  filterFlights(
    @Body() body: { flights: any[]; filters: FlightFilterDto },
  ): {
    flights: any[];
    appliedFilters: FlightFilterDto;
    count: number;
  } {
    let filtered = [...body.flights];

    // Apply filters
    if (body.filters) {
      filtered = rankingEngine.filterFlights(filtered, {
        maxPrice: body.filters.maxPrice,
        maxStops: body.filters.maxStops,
        maxDuration: body.filters.maxDuration,
        airlines: body.filters.airlines,
      });
    }

    // Apply sorting
    if (body.filters?.sortBy) {
      const sortOrder = body.filters.sortOrder === 'asc' ? 1 : -1;

      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (body.filters.sortBy) {
          case 'price':
            aVal = a.price;
            bVal = b.price;
            break;
          case 'duration':
            aVal = a.duration;
            bVal = b.duration;
            break;
          case 'stops':
            aVal = a.stops;
            bVal = b.stops;
            break;
          case 'score':
            aVal = a.rankingScore || 0;
            bVal = b.rankingScore || 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return -1 * sortOrder;
        if (aVal > bVal) return 1 * sortOrder;
        return 0;
      });
    }

    return {
      flights: filtered,
      appliedFilters: body.filters,
      count: filtered.length,
    };
  }

  /**
   * GET /api/flights/health
   * Health check endpoint
   */
  @Get('health')
  health(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
