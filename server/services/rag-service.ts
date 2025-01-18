import { Pinecone } from "@pinecone-database/pinecone";
import type { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { readFileSync } from 'fs';
import { join } from 'path';
import { dataCollectionService } from './data-collection-service';

export interface ReferenceDocument {
  id: string;
  type: "fda_guideline" | "study_template" | "past_study";
  title: string;
  content: string;
  metadata: {
    category: string;
    lastUpdated: string;
    source: string;
    doi?: string;
  };
}

class RAGService {
  private pinecone: Pinecone | null = null;
  private embeddings: OpenAIEmbeddings | null = null;
  private readonly indexName = "protocol-refs";
  private initialized = false;
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000;

  constructor() {
    this.initializeServices().catch(console.error);
  }

  private async initializeServices() {
    if (!process.env.PINECONE_API_KEY) {
      console.error("Warning: PINECONE_API_KEY not set. RAG features will be disabled.");
      return;
    }

    try {
      console.log("Initializing RAG service...");

      // Initialize Pinecone client with just the API key
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-ada-002"
      });

      // List existing indexes with error handling
      let existingIndexes;
      try {
        existingIndexes = await this.pinecone.listIndexes();
      } catch (error) {
        console.log("Error listing indexes, assuming none exist:", error);
        existingIndexes = { indexes: [] };
      }

      const indexExists = existingIndexes.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`Creating new Pinecone index: ${this.indexName}`);
        try {
          await this.pinecone.createIndex({
            name: this.indexName,
            dimension: 1536, // dimension for text-embedding-ada-002
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'aws',
                region: 'us-east-1'
              }
            }
          });

          // Wait for index to be ready with timeout
          let attempts = 0;
          const maxAttempts = 12; // 1 minute total
          while (attempts < maxAttempts) {
            try {
              const indexStatus = await this.pinecone.describeIndex(this.indexName);
              if (indexStatus.status?.ready) {
                console.log("Index is ready");
                break;
              }
            } catch (error) {
              console.log('Error checking index status, retrying...', error);
            }
            console.log('Waiting for index to be ready...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
          }

          if (attempts === maxAttempts) {
            throw new Error("Timeout waiting for Pinecone index to be ready");
          }
        } catch (error) {
          console.error("Failed to create index:", error);
          throw error;
        }
      } else {
        console.log(`Using existing Pinecone index: ${this.indexName}`);
      }

      this.initialized = true;
      console.log("RAG service initialized successfully");

      // Load initial data if index is empty
      await this.loadInitialData();
      await this.loadPublicStudies();
    } catch (error) {
      console.error("Failed to initialize RAG service:", error);
      this.initialized = false;
      // Attempt to recover from initialization failure
      setTimeout(() => this.initializeServices(), this.retryDelay);
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
          },
          {
            id: "study-002",
            type: "past_study",
            title: "Impact of Plant-Based Recovery Supplements on Exercise Performance",
            content: readFileSync(join(__dirname, '../data/past_studies/exercise_recovery.txt'), 'utf-8'),
            metadata: {
              category: "exercise",
              lastUpdated: "2024-01-18",
              source: "Journal of Sports Science"
            }
          },
          {
            id: "study-003",
            type: "past_study",
            title: "Effects of Digital Mindfulness Program on Chronic Stress Management",
            content: readFileSync(join(__dirname, '../data/past_studies/mindfulness_stress.txt'), 'utf-8'),
            metadata: {
              category: "stress",
              lastUpdated: "2024-01-18",
              source: "Journal of Behavioral Medicine"
            }
          }
        ];

        // Index all documents with retry logic
        const allDocuments = [...fdaGuidelines, ...studyTemplates, ...pastStudies];
        for (const doc of allDocuments) {
          let retries = 0;
          while (retries < this.maxRetries) {
            try {
              await this.indexDocument(doc);
              console.log(`Successfully indexed document: ${doc.title}`);
              break;
            } catch (error) {
              retries++;
              if (retries === this.maxRetries) {
                console.error(`Failed to index document ${doc.title} after ${this.maxRetries} attempts:`, error);
                throw error;
              }
              console.log(`Retry ${retries}/${this.maxRetries} for document ${doc.title}`);
              await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
          }
        }

        console.log(`Successfully loaded ${allDocuments.length} reference documents`);
      } else {
        console.log(`Found ${stats.totalRecordCount} existing documents in the index`);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
      throw error;
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
      console.log(`Generating contextual prompt for ${productName} in category: ${category}`);

      const relevantDocs = await this.queryRelevantDocuments(
        `${productName} ${hypothesis}`,
        category.toLowerCase()
      );

      const contextContent = relevantDocs.length > 0
        ? `Based on analysis of ${relevantDocs.length} relevant studies and guidelines:\n\n${relevantDocs.join("\n\n")}`
        : "No relevant reference materials found. Following general best practices for study design.";

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

The protocol should incorporate best practices and guidelines from the reference materials while being specifically tailored to this study. Consider:
1. Statistical power for participant count
2. Study duration based on similar successful studies
3. Relevant biomarkers and metrics for the category
4. Category-specific safety considerations
5. Appropriate questionnaires and assessments
`;
    } catch (error) {
      console.error("Failed to generate contextual prompt:", error);
      // Provide a simplified fallback prompt
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

  async loadPublicStudies() {
    if (!this.initialized || !this.pinecone) {
      throw new Error("RAG service not initialized");
    }

    try {
      console.log("Starting collection of public wellness studies...");

      const categories = [
        "Sleep",
        "Stress",
        "Exercise",
        "Nutrition",
        "Mindfulness",
        "Recovery",
        "Cognitive Performance"
      ];

      const studies = await dataCollectionService.collectWellnessStudies(categories);
      console.log(`Collected ${studies.length} studies from PubMed`);

      // Index in batches
      const batchSize = 50;
      for (let i = 0; i < studies.length; i += batchSize) {
        const batch = studies.slice(i, i + batchSize);
        console.log(`Indexing batch ${i/batchSize + 1}/${Math.ceil(studies.length/batchSize)}`);

        for (const study of batch) {
          let retries = 0;
          while (retries < this.maxRetries) {
            try {
              await this.indexDocument(study);
              console.log(`Successfully indexed study: ${study.title}`);
              break;
            } catch (error) {
              retries++;
              if (retries === this.maxRetries) {
                console.error(`Failed to index study ${study.title} after ${this.maxRetries} attempts:`, error);
                continue; // Skip this study and move to next
              }
              console.log(`Retry ${retries}/${this.maxRetries} for study ${study.title}`);
              await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
          }
        }

        // Rate limiting between batches
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log("Successfully loaded public studies into vector database");
      return true;
    } catch (error) {
      console.error("Failed to load public studies:", error);
      return false;
    }
  }
}

export const ragService = new RAGService();