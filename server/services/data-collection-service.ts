import type { ReferenceDocument } from './rag-service';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PubMedArticle {
  title: string;
  abstract: string;
  keywords: string[];
  publicationDate: string;
  doi?: string;
}

export class DataCollectionService {
  private readonly PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly BATCH_SIZE = 100;
  private readonly parser = new XMLParser();

  constructor(private apiKey?: string) {}

  async collectWellnessStudies(categories: string[], startYear: number = 2015): Promise<ReferenceDocument[]> {
    const studies: ReferenceDocument[] = [];
    let totalProcessed = 0;

    for (const category of categories) {
      console.log(`Collecting studies for category: ${category}`);

      // Build PubMed query
      const query = `${category}[Title/Abstract] AND ("wellness"[Title/Abstract] OR "clinical trial"[Publication Type])`;

      try {
        // First get IDs of relevant articles
        const searchUrl = `${this.PUBMED_API_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=1000&mindate=${startYear}&maxdate=2024&retmode=json${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;

        const searchResponse = await axios.get(searchUrl);
        const articleIds = searchResponse.data.esearchresult.idlist;
        console.log(`Found ${articleIds.length} articles for category ${category}`);

        // Fetch articles in batches
        for (let i = 0; i < articleIds.length; i += this.BATCH_SIZE) {
          const batchIds = articleIds.slice(i, i + this.BATCH_SIZE);
          const fetchUrl = `${this.PUBMED_API_BASE}/efetch.fcgi?db=pubmed&id=${batchIds.join(',')}&retmode=xml${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;

          const fetchResponse = await axios.get(fetchUrl);
          const articles = this.parseArticles(fetchResponse.data);

          // Convert to our document format
          const documents = articles.map((article, index) => ({
            id: `pubmed-${category}-${i + index}`,
            type: "past_study" as const,
            title: article.title,
            content: this.formatStudyContent(article),
            metadata: {
              category: category.toLowerCase(),
              lastUpdated: new Date().toISOString().split('T')[0],
              source: "PubMed Central",
              doi: article.doi
            }
          }));

          studies.push(...documents);
          totalProcessed += documents.length;
          console.log(`Processed ${documents.length} studies in current batch. Total: ${totalProcessed}`);

          // Save to files for persistence
          const dataDir = join(__dirname, '../data/past_studies');
          documents.forEach(doc => {
            const filePath = join(dataDir, `pubmed_${doc.id}.txt`);
            writeFileSync(filePath, doc.content);
          });

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error collecting studies for category ${category}:`, error);
      }
    }

    console.log(`Total studies collected: ${studies.length}`);
    return studies;
  }

  private parseArticles(xmlData: string): PubMedArticle[] {
    const result = this.parser.parse(xmlData);
    const articles = Array.isArray(result.PubmedArticleSet.PubmedArticle) 
      ? result.PubmedArticleSet.PubmedArticle 
      : [result.PubmedArticleSet.PubmedArticle];

    return articles.map((article: any) => ({
      title: article.MedlineCitation.Article.ArticleTitle,
      abstract: article.MedlineCitation.Article.Abstract?.AbstractText || '',
      keywords: article.MedlineCitation.KeywordList?.Keyword || [],
      publicationDate: article.MedlineCitation.DateCompleted?.Year || '',
      doi: article.PubmedData?.ArticleIdList?.ArticleId?.find((id: any) => id['@_IdType'] === 'doi')?.['#text']
    }));
  }

  private formatStudyContent(article: PubMedArticle): string {
    return `Study Title: ${article.title}
    
Study Summary:
${article.abstract}
    
Methodology:
    
1. Study Type
- Clinical trial
- Publication Date: ${article.publicationDate}
${article.doi ? `- DOI: ${article.doi}` : ''}
    
2. Keywords
${article.keywords.map(kw => `- ${kw}`).join('\n')}
    
3. Key Findings
${this.extractKeyFindings(article.abstract)}
    
This study provides insights into:
${this.extractInsights(article.abstract, article.keywords)}
`;
  }

  private extractKeyFindings(abstract: string): string {
    // Simple extraction of sentences containing result indicators
    const resultIndicators = ['found', 'showed', 'demonstrated', 'indicated', 'concluded'];
    const sentences = abstract.split(/[.!?]+/);

    const findings = sentences
      .filter(sentence => 
        resultIndicators.some(indicator => 
          sentence.toLowerCase().includes(indicator)
        )
      )
      .map(sentence => `- ${sentence.trim()}`);

    return findings.length > 0 
      ? findings.join('\n')
      : '- Findings extraction requires manual review';
  }

  private extractInsights(abstract: string, keywords: string[]): string {
    return keywords
      .slice(0, 3)
      .map(keyword => `- ${keyword} assessment methods and outcomes`)
      .join('\n');
  }
}

export const dataCollectionService = new DataCollectionService(process.env.PUBMED_API_KEY);