import { generateLiteratureReview } from '../literatureReview';
import '@testing-library/jest-dom';

describe('Literature Review Generation', () => {
  // Increase timeout for all tests
  jest.setTimeout(60000); // 60 seconds

  it('should generate a literature review for a magnesium sleep supplement', async () => {
    const productName = "Magnesium Sleep Supplement";
    const ingredients = ["Magnesium Citrate"];

    const review = await generateLiteratureReview(productName, ingredients);
    expect(review).toBeTruthy();
    expect(typeof review).toBe('string');

    // Verify structure contains key sections
    expect(review).toContain('Overview');
    expect(review).toContain('Primary Benefits');
    expect(review).toContain('Common Supplement Forms');
    expect(review).toContain('Impact on Key Wellness Areas');
    expect(review).toContain('Research Gaps');
    expect(review).toContain('Conclusion');
  });

  it('should generate a literature review for a multi-ingredient supplement', async () => {
    const productName = "Sleep Complex";
    const ingredients = ["Melatonin", "L-Theanine", "GABA"];

    const review = await generateLiteratureReview(productName, ingredients);
    expect(review).toBeTruthy();
    expect(typeof review).toBe('string');

    // Verify each ingredient is mentioned
    ingredients.forEach(ingredient => {
      expect(review.toLowerCase()).toContain(ingredient.toLowerCase());
    });

    // Verify wellness areas are covered
    expect(review).toMatch(/Sleep & Recovery|Physical Performance|Cognitive Function/);
  });

  it('should handle empty inputs', async () => {
    const productName = "";
    const ingredients: string[] = [];

    await expect(generateLiteratureReview(productName, ingredients))
      .rejects
      .toThrow("Product name and at least one ingredient are required");
  });
});