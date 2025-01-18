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
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    textNodeName: "#text",
    isArray: (name, jpath, isLeafNode, isAttribute) => {
      // Always treat these as arrays for consistent handling
      if (name === 'PubmedArticle' || name === 'ArticleId' || name === 'Keyword') return true;
      return false;
    }
  });

  constructor(private apiKey?: string) {}

  async collectWellnessStudies(categories: string[], startYear: number = 2015): Promise<ReferenceDocument[]> {
    console.log(`Starting collection of wellness studies from ${startYear} to present...`);
    const studies: ReferenceDocument[] = [];
    let totalProcessed = 0;

    for (const category of categories) {
      console.log(`Processing category: ${category}`);
      try {
        const query = `${category}[Title/Abstract] AND ("wellness"[Title/Abstract] OR "clinical trial"[Publication Type])`;
        const searchUrl = `${this.PUBMED_API_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=1000&mindate=${startYear}&maxdate=2024&retmode=json${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;

        const searchResponse = await axios.get(searchUrl);
        const articleIds = searchResponse.data.esearchresult.idlist || [];
        console.log(`Found ${articleIds.length} articles for category ${category}`);

        for (let i = 0; i < articleIds.length; i += this.BATCH_SIZE) {
          const batchIds = articleIds.slice(i, i + this.BATCH_SIZE);
          const fetchUrl = `${this.PUBMED_API_BASE}/efetch.fcgi?db=pubmed&id=${batchIds.join(',')}&retmode=xml${this.apiKey ? `&api_key=${this.apiKey}` : ''}`;

          try {
            const fetchResponse = await axios.get(fetchUrl);
            const articles = await this.parseArticles(fetchResponse.data);
            console.log(`Successfully parsed ${articles.length} articles from batch`);

            const validArticles = articles.filter(article => 
              article.title && 
              article.abstract && 
              article.abstract.length > 100 // Ensure we have substantial abstract content
            );

            const documents = validArticles.map((article, index) => ({
              id: `pubmed-${category.toLowerCase()}-${totalProcessed + index}`,
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
            console.log(`Processed ${documents.length} valid studies in current batch. Total: ${totalProcessed}`);

            // Save to files for persistence
            const dataDir = join(__dirname, '../data/past_studies');
            for (const doc of documents) {
              try {
                const filePath = join(dataDir, `pubmed_${doc.id}.txt`);
                writeFileSync(filePath, doc.content);
              } catch (error) {
                console.error(`Error saving document ${doc.id}:`, error);
              }
            }

          } catch (error) {
            console.error(`Error processing batch for category ${category}:`, error);
            continue;
          }

          // Rate limiting between batches
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error collecting studies for category ${category}:`, error);
        continue;
      }
    }

    console.log(`Collection complete. Total studies processed: ${totalProcessed}`);
    return studies;
  }

  private async parseArticles(xmlData: string): Promise<PubMedArticle[]> {
    try {
      const result = this.parser.parse(xmlData);
      const articles = result.PubmedArticleSet?.PubmedArticle || [];

      return articles.map((article: any) => {
        try {
          const medlineCitation = article?.MedlineCitation;
          const articleData = medlineCitation?.Article;

          if (!articleData) {
            throw new Error("Invalid article structure");
          }

          // Extract abstract text with proper error handling
          let abstract = '';
          const abstractText = articleData.Abstract?.AbstractText;
          if (Array.isArray(abstractText)) {
            abstract = abstractText
              .map(text => (typeof text === 'string' ? text : text?.['#text'] || ''))
              .filter(Boolean)
              .join(' ');
          } else if (typeof abstractText === 'string') {
            abstract = abstractText;
          } else if (abstractText?.['#text']) {
            abstract = abstractText['#text'];
          }

          // Extract DOI with proper error handling
          let doi: string | undefined;
          const articleIds = article.PubmedData?.ArticleIdList?.ArticleId || [];
          const doiArticle = articleIds.find((id: any) => id?.['@_IdType'] === 'doi');
          if (doiArticle) {
            doi = typeof doiArticle === 'string' ? doiArticle : doiArticle['#text'];
          }

          // Extract keywords with proper error handling
          let keywords: string[] = [];
          const keywordList = medlineCitation.KeywordList?.Keyword;
          if (Array.isArray(keywordList)) {
            keywords = keywordList
              .map(k => (typeof k === 'string' ? k : k?.['#text']))
              .filter(Boolean);
          }

          // Extract publication date
          const pubDate = medlineCitation.DateCompleted || medlineCitation.DateRevised;
          const publicationDate = pubDate ? `${pubDate.Year || ''}` : '';

          // Extract title with proper error handling
          const title = typeof articleData.ArticleTitle === 'string' 
            ? articleData.ArticleTitle 
            : articleData.ArticleTitle?.['#text'] || '';

          return {
            title: title.trim(),
            abstract: abstract.trim(),
            keywords,
            publicationDate,
            doi
          };
        } catch (error) {
          console.error("Error parsing individual article:", error);
          return null;
        }
      }).filter((article): article is PubMedArticle => 
        article !== null && 
        typeof article.title === 'string' && 
        article.title.length > 0 &&
        typeof article.abstract === 'string' && 
        article.abstract.length > 0
      );
    } catch (error) {
      console.error("Error parsing XML data:", error);
      return [];
    }
  }

  private formatStudyContent(article: PubMedArticle): string {
    try {
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
    } catch (error) {
      console.error("Error formatting study content:", error);
      return "";
    }
  }

  private extractKeyFindings(abstract: string): string {
    if (!abstract) {
      return '- Findings extraction requires manual review';
    }

    try {
      const resultIndicators = ['found', 'showed', 'demonstrated', 'indicated', 'concluded', 'revealed'];
      const sentences = abstract.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const findings = sentences
        .filter(sentence => 
          resultIndicators.some(indicator => 
            sentence.toLowerCase().includes(indicator)
          )
        )
        .map(sentence => `- ${sentence}`);

      return findings.length > 0 
        ? findings.join('\n')
        : '- Findings extraction requires manual review';
    } catch (error) {
      console.error("Error extracting findings:", error);
      return '- Findings extraction requires manual review';
    }
  }

  private extractInsights(abstract: string, keywords: string[]): string {
    if (!abstract || !keywords?.length) {
      return '- General research methodology and outcomes';
    }

    try {
      const relevantKeywords = keywords
        .filter(k => k && k.length > 0)
        .slice(0, 3);

      return relevantKeywords.length > 0
        ? relevantKeywords
            .map(keyword => `- ${keyword} assessment methods and outcomes`)
            .join('\n')
        : '- General research methodology and outcomes';
    } catch (error) {
      console.error("Error extracting insights:", error);
      return '- General research methodology and outcomes';
    }
  }
}

export const dataCollectionService = new DataCollectionService(process.env.PUBMED_API_KEY);