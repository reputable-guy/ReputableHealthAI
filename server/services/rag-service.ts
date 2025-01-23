import { Pinecone } from "@pinecone-database/pinecone";
import type { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dataCollectionService } from './data-collection-service';

// Get the directory path in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Go up one level to the server directory
const SERVER_DIR = dirname(__dirname);

/**
 * Interface representing a document in the research knowledge base
 * @interface ReferenceDocument
 */
export interface ReferenceDocument {
  /** Unique identifier for the document */
  id: string;
  /** Type of the document: FDA guideline, study template, or past study */
  type: "fda_guideline" | "study_template" | "past_study";
  /** Document title */
  title: string;
  /** Main content of the document */
  content: string;
  /** Additional metadata about the document */
  metadata: {
    /** Research category (e.g., sleep, stress, recovery) */
    category: string;
    /** Last update timestamp */
    lastUpdated: string;
    /** Source of the document */
    source: string;
    /** Optional DOI for academic papers */
    doi?: string;
  };
}

/**
 * RAG (Retrieval Augmented Generation) Service
 * Manages the retrieval and processing of research documents for protocol generation
 * 
 * Key responsibilities:
 * 1. Initialize and maintain connection to Pinecone vector database
 * 2. Process and index research documents
 * 3. Retrieve relevant documents for protocol generation
 * 4. Generate contextual prompts for protocol creation
 */
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

  /**
   * Initializes the RAG service by setting up Pinecone and OpenAI connections
   * Creates or connects to existing Pinecone index for document storage
   * @private
   * @returns {Promise<void>}
   */
  private async initializeServices() {
    try {
      console.log("Initializing RAG service...");

      // Initialize Pinecone client with API key validation
      if (!process.env.PINECONE_API_KEY) {
        throw new Error("PINECONE_API_KEY is required");
      }
      console.log("Creating Pinecone client...");
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      // Initialize OpenAI embeddings with API key validation
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required");
      }
      console.log("Setting up OpenAI embeddings...");
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-ada-002"
      });

      // Verify and setup Pinecone index
      console.log("Checking existing indexes...");
      const existingIndexes = await this.pinecone.listIndexes();
      console.log("Found existing indexes:", existingIndexes);

      const indexExists = existingIndexes.indexes?.some(index => index.name === this.indexName);
      console.log(`Index ${this.indexName} exists: ${indexExists}`);

      if (!indexExists) {
        await this.createPineconeIndex();
      } else {
        console.log(`Using existing Pinecone index: ${this.indexName}`);
      }

      this.initialized = true;
      console.log("RAG service initialized successfully");

      // Load initial reference documents if needed
      await this.loadInitialData();
      //await this.loadPublicStudies(); //Commented out per instruction.
    } catch (error) {
      console.error("Failed to initialize RAG service:", error);
      this.initialized = false;
      // Attempt to recover from initialization failure
      setTimeout(() => this.initializeServices(), this.retryDelay);
    }
  }

  /**
   * Creates a new Pinecone index with retry logic
   * @private
   * @returns {Promise<void>}
   */
  private async createPineconeIndex(): Promise<void> {
    console.log(`Creating new Pinecone index: ${this.indexName}`);
    try {
      await this.pinecone!.createIndex({
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

      console.log("Index creation initiated, waiting for readiness...");
      await this.waitForIndexReadiness();
    } catch (error) {
      console.error("Failed to create index:", error);
      throw error;
    }
  }

  /**
   * Waits for the Pinecone index to be ready with timeout
   * @private
   * @returns {Promise<void>}
   */
  private async waitForIndexReadiness(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 12; // 1 minute total with 5-second intervals

    while (attempts < maxAttempts) {
      try {
        const indexStatus = await this.pinecone!.describeIndex(this.indexName);
        console.log("Index status:", indexStatus);
        if (indexStatus.status?.ready) {
          console.log("Index is ready");
          return;
        }
      } catch (error) {
        console.error('Error checking index status:', error);
      }
      console.log('Waiting for index to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error("Timeout waiting for Pinecone index to be ready");
  }

  /**
   * Loads initial reference documents into the vector database
   * Only loads if the index is empty to avoid duplicates
   * @private
   * @returns {Promise<void>}
   */
  private async loadInitialData() {
    if (!this.initialized || !this.pinecone) {
      console.warn("RAG service not initialized, skipping initial data load");
      return;
    }

    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      console.log(`Current index stats - Total records: ${stats.totalRecordCount}`);

      if (stats.totalRecordCount === 0) {
        console.log("Loading initial reference documents into Pinecone...");

        // Load and process reference documents
        const referenceDocuments = await this.loadReferenceDocuments();

        // Index documents with retry logic
        for (const doc of referenceDocuments) {
          await this.indexDocumentWithRetry(doc);
        }

        console.log(`Successfully loaded ${referenceDocuments.length} reference documents`);
      } else {
        console.log(`Found ${stats.totalRecordCount} existing documents in the index`);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
      throw error;
    }
  }

  /**
   * Loads reference documents from the filesystem
   * @private
   * @returns {Promise<ReferenceDocument[]>}
   */
  private async loadReferenceDocuments(): Promise<ReferenceDocument[]> {
    // Load FDA guidelines
    const fdaGuidelines: ReferenceDocument[] = [
      {
        id: "fda-001",
        type: "fda_guideline",
        title: "FDA Guidance for Industry: Patient-Reported Outcome Measures",
        content: readFileSync(join(SERVER_DIR, 'data/fda/pro_guidance.txt'), 'utf-8'),
        metadata: {
          category: "methodology",
          lastUpdated: new Date().toISOString(),
          source: "FDA.gov"
        }
      },
      {
        id: "fda-002",
        type: "fda_guideline",
        title: "FDA Guidance on Safety Monitoring in Clinical Investigations",
        content: readFileSync(join(SERVER_DIR, 'data/fda/safety_monitoring.txt'), 'utf-8'),
        metadata: {
          category: "safety",
          lastUpdated: new Date().toISOString(),
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
        content: readFileSync(join(SERVER_DIR, 'data/templates/sleep_study.txt'), 'utf-8'),
        metadata: {
          category: "sleep",
          lastUpdated: new Date().toISOString(),
          source: "Research Protocol Database"
        }
      },
      {
        id: "template-002",
        type: "study_template",
        title: "Stress Response Study Template",
        content: readFileSync(join(SERVER_DIR, 'data/templates/stress_study.txt'), 'utf-8'),
        metadata: {
          category: "stress",
          lastUpdated: new Date().toISOString(),
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
        content: readFileSync(join(SERVER_DIR, 'data/past_studies/magnesium_sleep.txt'), 'utf-8'),
        metadata: {
          category: "sleep",
          lastUpdated: new Date().toISOString(),
          source: "Journal of Sleep Research"
        }
      },
      {
        id: "study-002",
        type: "past_study",
        title: "Impact of Plant-Based Recovery Supplements on Exercise Performance",
        content: readFileSync(join(SERVER_DIR, 'data/past_studies/exercise_recovery.txt'), 'utf-8'),
        metadata: {
          category: "exercise",
          lastUpdated: new Date().toISOString(),
          source: "Journal of Sports Science"
        }
      },
      {
        id: "study-003",
        type: "past_study",
        title: "Effects of Digital Mindfulness Program on Chronic Stress Management",
        content: readFileSync(join(SERVER_DIR, 'data/past_studies/mindfulness_stress.txt'), 'utf-8'),
        metadata: {
          category: "stress",
          lastUpdated: new Date().toISOString(),
          source: "Journal of Behavioral Medicine"
        }
      }
    ];

    return [...fdaGuidelines, ...studyTemplates, ...pastStudies];
  }

  /**
   * Indexes a document with retry logic
   * @private
   * @param {ReferenceDocument} doc - Document to index
   * @returns {Promise<void>}
   */
  private async indexDocumentWithRetry(doc: ReferenceDocument): Promise<void> {
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

  /**
   * Indexes a single document into Pinecone
   * Splits document into chunks and generates embeddings
   * @param {ReferenceDocument} doc - Document to index
   * @returns {Promise<void>}
   */
  async indexDocument(doc: ReferenceDocument): Promise<void> {
    if (!this.initialized || !this.pinecone || !this.embeddings) {
      throw new Error("RAG service not initialized");
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    try {
      // Split document into manageable chunks
      const chunks = await textSplitter.splitText(doc.content);
      const index = this.pinecone.index(this.indexName);

      // Process chunks in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await this.embeddings.embedDocuments(batch);

        // Create vectors with metadata
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

        // Upload vectors to Pinecone
        await index.upsert(vectors);
      }
    } catch (error) {
      console.error("Failed to index document:", error);
      throw error;
    }
  }


  /**
   * Queries the vector database for relevant documents based on input
   * @param {string} query - The search query
   * @param {string} category - The research category to filter by
   * @returns {Promise<string[]>} Array of relevant document chunks
   */
  async queryRelevantDocuments(query: string, category: string): Promise<string[]> {
    if (!this.initialized || !this.pinecone || !this.embeddings) {
      console.warn("RAG service not initialized, returning empty results");
      return [];
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const index = this.pinecone.index(this.indexName);

      // Search for similar vectors in the database
      const queryResult = await index.query({
        vector: queryEmbedding,
        filter: { category }, // Filter by research category
        topK: 5, // Return top 5 most relevant results
        includeMetadata: true,
      });

      // Extract and return the text chunks from the results
      return queryResult.matches
        .filter(match => match.metadata && typeof match.metadata.chunk === 'string')
        .map(match => match.metadata!.chunk as string);
    } catch (error) {
      console.error("Failed to query documents:", error);
      return [];
    }
  }

  /**
   * Generates a contextual prompt for protocol generation
   * Combines relevant documents with the input parameters
   * @param {string} productName - Name of the product
   * @param {string} category - Research category
   * @param {string} hypothesis - Research hypothesis
   * @returns {Promise<string>} Generated prompt with context
   */
  async generateContextualPrompt(
    productName: string,
    category: string,
    hypothesis: string
  ): Promise<string> {
    try {
      console.log(`Generating contextual prompt for ${productName} in category: ${category}`);

      // Retrieve relevant documents for context
      const relevantDocs = await this.queryRelevantDocuments(
        `${productName} ${hypothesis}`,
        category.toLowerCase()
      );

      // Build context section based on available documents
      const contextContent = relevantDocs.length > 0
        ? `Based on analysis of ${relevantDocs.length} relevant studies and guidelines:\n\n${relevantDocs.join("\n\n")}`
        : "No relevant reference materials found. Following general best practices for study design.";

      // Generate structured prompt with context
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
      return this.generateFallbackPrompt(productName, hypothesis, category);
    }
  }

  /**
   * Generates a fallback prompt when context generation fails
   * @private
   * @param {string} productName - Name of the product
   * @param {string} hypothesis - Research hypothesis
   * @param {string} category - Research category
   * @returns {string} Basic prompt without context
   */
  private generateFallbackPrompt(
    productName: string,
    hypothesis: string,
    category: string
  ): string {
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

  /**
   * Checks the current statistics of the Pinecone index
   * @returns {Promise<any | null>} Index statistics or null if unavailable
   */
  async checkIndexStats() {
    if (!this.initialized || !this.pinecone) {
      console.log("RAG service not initialized, cannot check stats");
      return null;
    }

    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();

      console.log("=== Pinecone Index Statistics ===");
      console.log(`Total vectors: ${stats.totalRecordCount}`);
      console.log(`Namespaces: ${Object.keys(stats.namespaces || {}).length}`);
      console.log("===============================");

      return stats;
    } catch (error) {
      console.error("Failed to fetch index stats:", error);
      return null;
    }
  }
  /**
   * Loads and indexes public wellness studies from PubMed
   * This is a resource-intensive operation that should be run manually
   * rather than during initialization
   * @returns {Promise<boolean>} Success status of the operation
   */
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

      // Index in batches to manage rate limits and memory
      const batchSize = 50;
      for (let i = 0; i < studies.length; i += batchSize) {
        const batch = studies.slice(i, i + batchSize);
        console.log(`Indexing batch ${i / batchSize + 1}/${Math.ceil(studies.length / batchSize)}`);

        // Process each study in the batch with retry logic
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
      await this.checkIndexStats();
      return true;
    } catch (error) {
      console.error("Failed to load public studies:", error);
      return false;
    }
  }
}

// Export singleton instance
export const ragService = new RAGService();