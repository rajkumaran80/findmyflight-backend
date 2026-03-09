import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ImageData } from '../common/types/attraction.types';

interface UnsplashPhoto {
  urls: { regular: string; full: string };
  alt_description: string | null;
  description: string | null;
  user: { name: string };
}

interface PexelsPhoto {
  id: number;
  src: { large: string; medium: string; original: string };
  alt: string;
  photographer: string;
}

@Injectable()
export class ImageService {
  private unsplashKey = process.env.UNSPLASH_ACCESS_KEY || '';
  private pexelsKey = process.env.PEXELS_API_KEY || '';

  async fetchImages(
    attractionName: string,
    city: string,
    country: string,
  ): Promise<ImageData[]> {
    console.log(`[IMAGES] Fetching images for: ${attractionName}, ${city}`);

    // Try Unsplash first
    if (this.unsplashKey) {
      const images = await this.fetchFromUnsplash(attractionName, city, country);
      if (images.length > 0) return images;
    }

    // Fallback to Pexels
    if (this.pexelsKey) {
      const images = await this.fetchFromPexels(attractionName, city, country);
      if (images.length > 0) return images;
    }

    console.warn('[IMAGES] No API keys or no results, returning placeholders');
    return this.getPlaceholders(attractionName, city, country);
  }

  private async fetchFromUnsplash(
    attractionName: string,
    city: string,
    country: string,
  ): Promise<ImageData[]> {
    const queries = [
      `${attractionName} ${city}`,
      `${attractionName}`,
      `${city} ${country}`,
    ];

    for (const query of queries) {
      try {
        const response = await axios.get('https://api.unsplash.com/search/photos', {
          headers: { Authorization: `Client-ID ${this.unsplashKey}` },
          params: { query, per_page: 3, orientation: 'landscape' },
          timeout: 10000,
        });

        const photos: UnsplashPhoto[] = response.data.results;
        if (photos.length > 0) {
          console.log(`[IMAGES] Found ${photos.length} images from Unsplash for "${query}"`);
          return photos.map((photo) => ({
            imageUrl: photo.urls.regular,
            altText: photo.alt_description || photo.description || `${attractionName} - ${city}, ${country}`,
            source: `Unsplash - ${photo.user.name}`,
          }));
        }
        console.log(`[IMAGES] No Unsplash results for "${query}", trying next query...`);
      } catch (error: any) {
        console.error('[IMAGES] Unsplash API error:', error?.message);
        break;
      }
    }

    return [];
  }

  private async fetchFromPexels(
    attractionName: string,
    city: string,
    country: string,
  ): Promise<ImageData[]> {
    const queries = [
      `${attractionName} ${city}`,
      `${city} ${country}`,
    ];

    for (const query of queries) {
      try {
        const response = await axios.get('https://api.pexels.com/v1/search', {
          headers: { Authorization: this.pexelsKey },
          params: { query, per_page: 3, orientation: 'landscape' },
          timeout: 10000,
        });

        const photos: PexelsPhoto[] = response.data.photos;
        if (photos.length > 0) {
          console.log(`[IMAGES] Found ${photos.length} images from Pexels for "${query}"`);
          return photos.map((photo) => ({
            imageUrl: photo.src.large,
            altText: photo.alt || `${attractionName} - ${city}, ${country}`,
            source: `Pexels - ${photo.photographer}`,
          }));
        }
      } catch (error: any) {
        console.error('[IMAGES] Pexels API error:', error?.message);
        break;
      }
    }

    return [];
  }

  private getPlaceholders(attractionName: string, city: string, country: string): ImageData[] {
    const text = encodeURIComponent(attractionName);
    return [
      {
        imageUrl: `https://placehold.co/800x600/4a90d9/white?text=${text}`,
        altText: `${attractionName} - ${city}, ${country}`,
        source: 'placeholder',
      },
    ];
  }
}
