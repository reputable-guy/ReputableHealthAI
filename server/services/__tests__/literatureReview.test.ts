import { generateLiteratureReview } from '../literatureReview';
import '@testing-library/jest-dom';

describe('Literature Review Generation', () => {
  // Increase timeout for all tests
  jest.setTimeout(60000); // 60 seconds

  it('should generate a literature review for a supplement product', async () => {
    const productName = "Sleep Support Plus";
    const websiteUrl = "https://example.com/sleep-support-plus";

    const review = await generateLiteratureReview(productName, websiteUrl);
    expect(review).toBeTruthy();

    // Verify structure contains all required sections
    expect(review.overview).toBeDefined();
    expect(review.overview.description).toBeTruthy();
    expect(Array.isArray(review.overview.benefits)).toBe(true);
    expect(Array.isArray(review.overview.supplementForms)).toBe(true);

    expect(Array.isArray(review.wellnessAreas)).toBe(true);
    expect(review.wellnessAreas.length).toBeGreaterThan(0);

    expect(review.researchGaps).toBeDefined();
    expect(Array.isArray(review.researchGaps.questions)).toBe(true);

    expect(review.conclusion).toBeDefined();
    expect(Array.isArray(review.conclusion.keyPoints)).toBe(true);
    expect(Array.isArray(review.conclusion.targetAudience)).toBe(true);
    expect(Array.isArray(review.conclusion.safetyConsiderations)).toBe(true);
  });

  it('should generate a literature review with only product name', async () => {
    const productName = "Vitamin D3 Supplement";

    const review = await generateLiteratureReview(productName);
    expect(review).toBeTruthy();
    expect(review.overview.description).toBeTruthy();
  });

  it('should handle empty product name', async () => {
    const productName = "";
    const websiteUrl = "https://example.com/product";

    await expect(generateLiteratureReview(productName, websiteUrl))
      .rejects
      .toThrow("Product name is required");
  });

  it('should handle invalid website URL gracefully', async () => {
    const productName = "Test Product";
    const websiteUrl = "https://nonexistent-website-12345.com";

    const review = await generateLiteratureReview(productName, websiteUrl);
    expect(review).toBeTruthy();
    expect(review.overview.description).toBeTruthy();
  });
});