import { IsString, IsOptional, IsNumber, IsEnum, Min, Max, ValidateIf, IsArray } from 'class-validator';

/**
 * DTO for flight search request
 */
export class FlightSearchDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;

  @IsString()
  departDate!: string; // YYYY-MM-DD format

  @IsOptional()
  @IsString()
  returnDate?: string; // YYYY-MM-DD format

  @IsNumber()
  @Min(1)
  @Max(9)
  passengers: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(9)
  adults?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(8)
  children?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  infants?: number;

  @IsEnum(['one-way', 'round-trip', 'multi-city'])
  tripType: 'one-way' | 'round-trip' | 'multi-city' = 'one-way';

  @IsOptional()
  @IsEnum(['economy', 'business', 'first', 'premium-economy'])
  cabin?: 'economy' | 'business' | 'first' | 'premium-economy';

  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeProviders?: string[];
}

/**
 * DTO for flight filter/sort request
 */
export class FlightFilterDto {
  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  maxStops?: number;

  @IsOptional()
  @IsNumber()
  maxDuration?: number; // In minutes

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  airlines?: string[];

  @IsOptional()
  @IsEnum(['price', 'duration', 'stops', 'score'])
  sortBy?: 'price' | 'duration' | 'stops' | 'score';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
