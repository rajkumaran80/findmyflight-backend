import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class RevalidationService {
  async revalidatePath(path: string): Promise<void> {
    const url = process.env.FRONTEND_REVALIDATE_URL;
    const secret = process.env.REVALIDATE_SECRET;

    if (!url) {
      console.warn('[REVALIDATION] FRONTEND_REVALIDATE_URL not set, skipping');
      return;
    }

    try {
      console.log(`[REVALIDATION] Triggering revalidation for: ${path}`);

      const response = await axios.post(
        url,
        { path },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-revalidate-secret': secret || '',
          },
          timeout: 10000,
        },
      );

      console.log(`[REVALIDATION] Success: ${response.status}`);
    } catch (error: any) {
      // Don't throw — revalidation failure shouldn't fail the generation job
      console.error(`[REVALIDATION] Failed for ${path}:`, error?.message);
    }
  }
}
