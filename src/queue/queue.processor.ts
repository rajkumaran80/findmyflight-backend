import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ContentGeneratorService } from '../content/content-generator.service';
import { ImageService } from '../images/image.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { AttractionJobData } from '../common/types/attraction.types';

@Injectable()
export class QueueProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentGenerator: ContentGeneratorService,
    private readonly imageService: ImageService,
    private readonly revalidationService: RevalidationService,
  ) {}

  async processGenerationJob(job: Job<AttractionJobData>): Promise<void> {
    const { attractionId, attractionName, countryName, city, slug } = job.data;
    console.log(`[PROCESSOR] Processing: ${attractionName} (${attractionId})`);

    try {
      // Step 1: Mark as generating
      await this.prisma.attraction.update({
        where: { id: attractionId },
        data: { status: 'GENERATING' },
      });

      // Step 2: Generate content via Claude API
      console.log(`[PROCESSOR] Generating content...`);
      const content = await this.contentGenerator.generateContent(attractionName, countryName, city);

      // Step 3: Fetch images (mock)
      console.log(`[PROCESSOR] Fetching images...`);
      const images = await this.imageService.fetchImages(attractionName, city, countryName);

      // Step 4: Save content to database
      console.log(`[PROCESSOR] Saving to database...`);
      await this.prisma.attraction.update({
        where: { id: attractionId },
        data: {
          status: 'COMPLETED',
          seoTitle: content.seoTitle,
          metaDescription: content.metaDescription,
          contentHtml: content.contentHtml,
          bestTimeToVisit: content.bestTimeToVisit,
          entryFee: content.entryFee,
          errorMessage: null,
        },
      });

      // Step 5: Save images
      for (const image of images) {
        await this.prisma.photo.create({
          data: {
            attractionId,
            imageUrl: image.imageUrl,
            altText: image.altText,
            source: image.source,
          },
        });
      }
      console.log(`[PROCESSOR] ${images.length} images saved`);

      // Step 6: Trigger frontend revalidation
      await this.revalidationService.revalidatePath(`/attractions/${slug}`);

      console.log(`[PROCESSOR] Completed: ${attractionName}`);
    } catch (error: any) {
      console.error(`[PROCESSOR] Failed: ${attractionName}`, error?.message);

      await this.prisma.attraction.update({
        where: { id: attractionId },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'Unknown error',
        },
      });

      throw error; // Re-throw for BullMQ retry
    }
  }
}
