import { Pinecone } from "@pinecone-database/pinecone";
import type { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { readFileSync } from 'fs';
import { join } from 'path';

interface ReferenceDocument {
  id: string;
  type: "fda_guideline" | "study_template" | "past_study";
  title: string;
  content: string;
  metadata: {
    category: string;
    lastUpdated: string;
    source: string;
  };
}

class RAGService {
  private pinecone: Pinecone | null = null;
  private embeddings: OpenAIEmbeddings | null = null;
  private readonly indexName = "protocol-references";
  private initialized = false;

  constructor() {
    this.initializeServices().catch(console.error);
  }

  private async initializeServices() {
    if (!process.env.PINECONE_API_KEY || !process.env.OPENAI_API_KEY) {
      console.error("Warning: PINECONE_API_KEY or OPENAI_API_KEY not set. RAG features will be disabled.");
      return;
    }

    try {
      // Initialize Pinecone with just the API key
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-ada-002"
      });

      // Check if index exists, create if it doesn't
      const indexes = await this.pinecone.listIndexes();
      const indexNames = indexes.indexes?.map(index => index.name) || [];

      if (!indexNames.includes(this.indexName)) {
        console.log(`Creating new Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536, // dimension for text-embedding-ada-002
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-west-2"
            }
          }
        });

        // Wait for index to be ready
        let indexStatus = await this.pinecone.describeIndex(this.indexName);
        while (indexStatus.status?.ready === false) {
          console.log('Waiting for index to be ready...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          indexStatus = await this.pinecone.describeIndex(this.indexName);
        }
      }

      this.initialized = true;
      console.log("RAG service initialized successfully");

      // Load initial data if index is empty
      await this.loadInitialData();
    } catch (error) {
      console.error("Failed to initialize RAG service:", error);
      this.initialized = false;
    }
  }

  private async loadInitialData() {
    if (!this.initialized || !this.pinecone) {
      console.warn("RAG service not initialized, skipping initial data load");
      return;
    }

    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();

      if (stats.totalRecordCount === 0) {
        console.log("Loading initial reference documents into Pinecone...");

        // Load FDA guidelines
        const fdaGuidelines: ReferenceDocument[] = [
          {
            id: "fda-001",
            type: "fda_guideline",
            title: "FDA Guidance for Industry: Patient-Reported Outcome Measures",
            content: readFileSync(join(__dirname, '../data/fda/pro_guidance.txt'), 'utf-8'),
            metadata: {
              category: "methodology",
              lastUpdated: "2024-01-18",
              source: "FDA.gov"
            }
          },
          {
            id: "fda-002",
            type: "fda_guideline",
            title: "FDA Guidance on Safety Monitoring in Clinical Investigations",
            content: readFileSync(join(__dirname, '../data/fda/safety_monitoring.txt'), 'utf-8'),
            metadata: {
              category: "safety",
              lastUpdated: "2024-01-18",
              source: "FDA.gov"
            }
          }
        ];

        // Load study templates
        const studyTemplates: ReferenceDocument[] = [
          {
            id: "template-001",
            type: "study_template",
            title: "Sleep Quality Assessment Protocol Template",
            content: readFileSync(join(__dirname, '../data/templates/sleep_study.txt'), 'utf-8'),
            metadata: {
              category: "sleep",
              lastUpdated: "2024-01-18",
              source: "Research Protocol Database"
            }
          },
          {
            id: "template-002",
            type: "study_template",
            title: "Stress Response Study Template",
            content: readFileSync(join(__dirname, '../data/templates/stress_study.txt'), 'utf-8'),
            metadata: {
              category: "stress",
              lastUpdated: "2024-01-18",
              source: "Research Protocol Database"
            }
          }
        ];

        // Load past studies
        const pastStudies: ReferenceDocument[] = [
          {
            id: "study-001",
            type: "past_study",
            title: "Effects of Magnesium Supplementation on Sleep Architecture",
            content: readFileSync(join(__dirname, '../data/past_studies/magnesium_sleep.txt'), 'utf-8'),
            metadata: {
              category: "sleep",
              lastUpdated: "2024-01-18",
              source: "Journal of Sleep Research"
            }
          }
        ];

        // Index all documents
        const allDocuments = [...fdaGuidelines, ...studyTemplates, ...pastStudies];
        for (const doc of allDocuments) {
          await this.indexDocument(doc);
          console.log(`Indexed document: ${doc.title}`);
        }

        console.log(`Successfully loaded ${allDocuments.length} reference documents`);
      } else {
        console.log(`Found ${stats.totalRecordCount} existing documents in the index`);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  }

  async indexDocument(doc: ReferenceDocument) {
    if (!this.initialized || !this.pinecone || !this.embeddings) {
      throw new Error("RAG service not initialized");
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    try {
      const chunks = await textSplitter.splitText(doc.content);
      const index = this.pinecone.index(this.indexName);

      // Process chunks in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await this.embeddings.embedDocuments(batch);
        const vectors = batch.map((chunk, idx) => ({
          id: `${doc.id}-chunk-${i + idx}`,
          values: embeddings[idx],
          metadata: {
            ...doc.metadata,
            type: doc.type,
            title: doc.title,
            chunk: chunk,
            originalDocId: doc.id
          },
        }));

        await index.upsert(vectors);
      }
    } catch (error) {
      console.error("Failed to index document:", error);
      throw error;
    }
  }

  async queryRelevantDocuments(query: string, category: string): Promise<string[]> {
    if (!this.initialized || !this.pinecone || !this.embeddings) {
      console.warn("RAG service not initialized, returning empty results");
      return [];
    }

    try {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const index = this.pinecone.index(this.indexName);

      const queryResult = await index.query({
        vector: queryEmbedding,
        filter: { category },
        topK: 5,
        includeMetadata: true,
      });

      return queryResult.matches
        .filter(match => match.metadata && typeof match.metadata.chunk === 'string')
        .map(match => match.metadata!.chunk as string);
    } catch (error) {
      console.error("Failed to query documents:", error);
      return [];
    }
  }

  async generateContextualPrompt(
    productName: string,
    category: string,
    hypothesis: string
  ): Promise<string> {
    try {
      const relevantDocs = await this.queryRelevantDocuments(
        `${productName} ${hypothesis}`,
        category
      );

      const contextContent = relevantDocs.length > 0
        ? relevantDocs.join("\n\n")
        : "No relevant reference materials found.";

      return `
Based on the following reference materials from FDA guidelines, study templates, and past research:

${contextContent}

Generate a comprehensive research protocol for the following:

Product Name: ${productName}
Research Hypothesis: ${hypothesis}
Study Category: ${category}

Provide the response in valid JSON format with the following structure:
{
  "studyCategory": string,
  "experimentTitle": string,
  "studyObjective": string,
  "studyType": string,
  "participantCount": number,
  "durationWeeks": number,
  "targetMetrics": string[],
  "questionnaires": string[],
  "studySummary": string,
  "participantInstructions": string[],
  "safetyPrecautions": string[],
  "educationalResources": [
    {
      "title": string,
      "description": string,
      "type": string
    }
  ],
  "consentFormSections": [
    {
      "title": string,
      "content": string
    }
  ],
  "customFactors": string[],
  "eligibilityCriteria": {
    "wearableData": [
      {
        "metric": string,
        "condition": string,
        "value": string
      }
    ],
    "demographics": [
      {
        "category": string,
        "requirement": string
      }
    ],
    "customQuestions": string[]
  }
}

The protocol should incorporate best practices and guidelines from the reference materials while being specifically tailored to this study.
`;
    } catch (error) {
      console.error("Failed to generate contextual prompt:", error);
      // Fallback to basic prompt without context
      return `
Generate a comprehensive research protocol for the following in JSON format:

Product Name: ${productName}
Research Hypothesis: ${hypothesis}
Study Category: ${category}

Response should be a valid JSON object with this structure:
{
  "studyCategory": string,
  "experimentTitle": string,
  "studyObjective": string,
  "studyType": string,
  "participantCount": number,
  "durationWeeks": number,
  "targetMetrics": string[],
  "questionnaires": string[],
  "studySummary": string,
  "participantInstructions": string[],
  "safetyPrecautions": string[],
  "educationalResources": [
    {
      "title": string,
      "description": string,
      "type": string
    }
  ],
  "consentFormSections": [
    {
      "title": string,
      "content": string
    }
  ],
  "customFactors": string[],
  "eligibilityCriteria": {
    "wearableData": [
      {
        "metric": string,
        "condition": string,
        "value": string
      }
    ],
    "demographics": [
      {
        "category": string,
        "requirement": string
      }
    ],
    "customQuestions": string[]
  }
}

The protocol should follow FDA guidelines and best practices while being specifically tailored to this study.
`;
    }
  }
}

export const ragService = new RAGService();