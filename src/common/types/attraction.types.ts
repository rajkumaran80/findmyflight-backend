export interface AttractionJobData {
  attractionId: string;
  attractionName: string;
  countryCode: string;
  countryName: string;
  city: string;
  latitude?: number;
  longitude?: number;
  slug: string;
}

export interface GeneratedContent {
  seoTitle: string;
  metaDescription: string;
  contentHtml: string;
  bestTimeToVisit: string;
  entryFee: string;
  faq: FAQ[];
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface ImageData {
  imageUrl: string;
  altText: string;
  source: string;
}
