import { scrapeWebsite } from './literatureReview';
import { z } from "zod";

export const verificationRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

export interface ProductVerification {
  scrapedContent: {
    rawText: string;
    wordCount: number;
    keyPhrases: string[];
  };
  productContext: {
    identifiedName: boolean;
    hasIngredients: boolean;
    hasDosage: boolean;
    contentQuality: 'Poor' | 'Fair' | 'Good';
  };
}

export async function verifyProduct(productName: string, websiteUrl?: string): Promise<ProductVerification> {
  let rawText = '';
  
  if (websiteUrl) {
    try {
      rawText = await scrapeWebsite(websiteUrl);
    } catch (error) {
      console.error('Error scraping website:', error);
    }
  }

  const wordCount = rawText.split(/\s+/).length;
  
  // Extract potential key phrases (ingredients, dosage info, etc.)
  const keyPhrases = extractKeyPhrases(rawText, productName);

  const verification: ProductVerification = {
    scrapedContent: {
      rawText: rawText.slice(0, 500) + (rawText.length > 500 ? '...' : ''), // First 500 chars
      wordCount,
      keyPhrases,
    },
    productContext: {
      identifiedName: rawText.toLowerCase().includes(productName.toLowerCase()),
      hasIngredients: /ingredients?:|contains?:/i.test(rawText),
      hasDosage: /dosage:|serving size:|recommended use:/i.test(rawText),
      contentQuality: evaluateContentQuality(wordCount, rawText),
    }
  };

  return verification;
}

function evaluateContentQuality(wordCount: number, content: string): 'Poor' | 'Fair' | 'Good' {
  if (wordCount < 100) return 'Poor';
  if (wordCount < 300) return 'Fair';
  return 'Good';
}

function extractKeyPhrases(text: string, productName: string): string[] {
  const phrases: string[] = [];
  
  // Look for ingredient lists
  const ingredientMatch = text.match(/ingredients?:([^.]*\.)/i);
  if (ingredientMatch) {
    phrases.push(ingredientMatch[1].trim());
  }

  // Look for dosage information
  const dosageMatch = text.match(/dosage:([^.]*\.)/i);
  if (dosageMatch) {
    phrases.push(dosageMatch[1].trim());
  }

  // Look for key benefits
  const benefitsMatch = text.match(/benefits?:([^.]*\.)/i);
  if (benefitsMatch) {
    phrases.push(benefitsMatch[1].trim());
  }

  // Add product name mentions in context
  const productContext = text.match(new RegExp(`[^.]*${productName}[^.]*\.`, 'gi'));
  if (productContext) {
    phrases.push(...productContext.slice(0, 2));
  }

  return phrases.map(p => p.trim()).filter(p => p.length > 0);
}
