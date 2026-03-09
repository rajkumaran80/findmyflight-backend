import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { z } from 'zod';
import { GeneratedContent } from '../common/types/attraction.types';
import { sanitizeHtml } from '../common/utils/html-sanitizer';

const ContentSchema = z.object({
  seoTitle: z.string().min(10).max(70),
  metaDescription: z.string().min(50).max(160),
  contentHtml: z.string().min(100),
  bestTimeToVisit: z.string(),
  entryFee: z.string(),
  faq: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).min(3),
});

@Injectable()
export class ContentGeneratorService {
  private anthropic: Anthropic | null = null;
  private provider: string;
  private ollamaUrl: string;
  private ollamaModel: string;
  private groqApiKey: string;
  private groqModel: string;

  constructor() {
    this.provider = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'gemma2:2b';
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    this.groqModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

    if (this.provider === 'claude') {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('[CONTENT] Using Claude API');
    } else if (this.provider === 'groq') {
      console.log(`[CONTENT] Using Groq (${this.groqModel})`);
    } else {
      console.log(`[CONTENT] Using Ollama (${this.ollamaModel}) at ${this.ollamaUrl}`);
    }
  }

  async generateContent(
    attractionName: string,
    country: string,
    city: string,
  ): Promise<GeneratedContent> {
    console.log(`[CONTENT] Generating content for: ${attractionName}, ${city}, ${country}`);

    const prompt = this.buildPrompt(attractionName, country, city);

    let responseText: string;

    if (this.provider === 'claude') {
      responseText = await this.callClaude(prompt);
    } else if (this.provider === 'groq') {
      responseText = await this.callGroq(prompt);
    } else {
      responseText = await this.callOllama(prompt);
    }

    console.log(`[CONTENT] Received ${responseText.length} characters from ${this.provider}`);

    // Parse JSON from response
    const parsed = this.parseJson(responseText);

    // Validate with Zod
    const validated = ContentSchema.parse(parsed);

    // Sanitize HTML
    validated.contentHtml = sanitizeHtml(validated.contentHtml);

    // Inject affiliate placeholders
    validated.contentHtml = this.injectAffiliatePlaceholders(validated.contentHtml, city, country);

    // Append FAQ as HTML
    if (validated.faq.length > 0) {
      const faqHtml = this.buildFaqHtml(validated.faq);
      validated.contentHtml += faqHtml;
    }

    console.log('[CONTENT] Content generated and validated successfully');
    return validated;
  }

  private async callClaude(prompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Claude API not initialized. Set LLM_PROVIDER=claude and provide ANTHROPIC_API_KEY.');
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    return block.text;
  }

  private async callGroq(prompt: string): Promise<string> {
    if (!this.groqApiKey) {
      throw new Error('Groq API key not set. Provide GROQ_API_KEY in .env');
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: this.groqModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    return response.data.choices[0].message.content;
  }

  private async callOllama(prompt: string): Promise<string> {
    const response = await axios.post(
      `${this.ollamaUrl}/api/generate`,
      {
        model: this.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 3000,
        },
      },
      { timeout: 120000 },
    );

    return response.data.response;
  }

  private buildPrompt(attractionName: string, country: string, city: string): string {
    return `You are an expert travel content writer for Travellyhub.com. Generate concise, scannable, SEO-optimized content for the following attraction.

Attraction: ${attractionName}
Location: ${city}, ${country}

IMPORTANT — Keep it SHORT and scannable:
- Total content should be around 250-300 words (NOT 1000+)
- Use bullet points (<ul><li>) to list features, highlights, tips, and nearby places
- Each section should have a brief 1-2 sentence intro followed by bullet points
- No long paragraphs — travelers want quick, useful info

Structure with these HTML sections:
- <h1> with the attraction name
- Brief 2-3 sentence introduction
- <h2>History</h2> — 2-3 sentences on the history and significance
- <h2>Highlights</h2> — bullet list of key features/things to see
- <h2>How to Reach</h2> — bullet list of transport options
- <h2>Visitor Tips</h2> — bullet list combining best time, entry fee, timings
- <h2>Nearby Attractions</h2> — bullet list of 3-4 nearby places
- <h2>Where to Stay</h2> — bullet list of 2-3 accommodation areas/options

Include 3 FAQs with short answers (1-2 sentences each).
Write in clean HTML only — no markdown, no inline styles.
Use semantic HTML: <section>, <h2>, <p>, <ul>, <li>

Return ONLY valid JSON (no markdown code fences) with this structure:
{
  "seoTitle": "Compelling title under 70 chars including location",
  "metaDescription": "Meta description 50-160 chars",
  "contentHtml": "<h1>...</h1><section>...</section>",
  "bestTimeToVisit": "Brief 1 sentence",
  "entryFee": "Fee info or 'Free entry'",
  "faq": [
    { "question": "FAQ question?", "answer": "Short answer" }
  ]
}`;
  }

  private parseJson(text: string): unknown {
    // Try to extract JSON from code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : null;

    if (!jsonStr) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0].trim();
      }
    }

    if (!jsonStr) {
      console.error('[CONTENT] No JSON found. Raw response:', text.substring(0, 500));
      throw new Error('No JSON found in LLM response');
    }

    // First try parsing as-is
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Fall through to cleanup
    }

    // Clean control characters that break JSON.parse
    // Only clean chars inside string values (between quotes)
    let cleaned = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const ch = jsonStr[i];

      if (escaped) {
        cleaned += ch;
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        cleaned += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        cleaned += ch;
        continue;
      }

      if (inString) {
        const code = ch.charCodeAt(0);
        if (code < 0x20) {
          // Replace control chars inside strings
          if (ch === '\n') cleaned += '\\n';
          else if (ch === '\r') cleaned += '\\r';
          else if (ch === '\t') cleaned += '\\t';
          // else skip other control chars
        } else {
          cleaned += ch;
        }
      } else {
        cleaned += ch;
      }
    }

    try {
      return JSON.parse(cleaned);
    } catch (e: any) {
      console.error('[CONTENT] JSON parse failed after cleanup. First 500 chars:', cleaned.substring(0, 500));
      throw new Error('Failed to parse LLM JSON response: ' + e.message);
    }
  }

  private injectAffiliatePlaceholders(html: string, city: string, country: string): string {
    // Insert flight search after the first section
    const firstSectionEnd = html.indexOf('</section>');
    if (firstSectionEnd !== -1) {
      const insertPos = firstSectionEnd + '</section>'.length;
      html = html.slice(0, insertPos) +
        '\n<div class="affiliate-widget" data-affiliate="flight">{{FLIGHT_SEARCH}}</div>\n' +
        html.slice(insertPos);
    }

    // Insert hotel search before "Where to Stay"
    html = html.replace(
      /(<h2[^>]*>Where to Stay<\/h2>)/i,
      '<div class="affiliate-widget" data-affiliate="hotel">{{HOTEL_SEARCH}}</div>\n$1',
    );

    // Insert tour widget after "Things to Do"
    html = html.replace(
      /(<h2[^>]*>Things to Do[^<]*<\/h2>)/i,
      '$1\n<div class="affiliate-widget" data-affiliate="tours">{{TOUR_WIDGET}}</div>',
    );

    return html;
  }

  private buildFaqHtml(faq: { question: string; answer: string }[]): string {
    const items = faq
      .map(
        (f) =>
          `<div class="faq-item">\n<h3>${f.question}</h3>\n<p>${f.answer}</p>\n</div>`,
      )
      .join('\n');

    return `\n<section class="faq-section">\n<h2>Frequently Asked Questions</h2>\n${items}\n</section>`;
  }
}
