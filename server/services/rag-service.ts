import { Pinecone } from "@pinecone-database/pinecone";
import { Pipeline, pipeline } from '@xenova/transformers';
import type { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// Custom type for the embedding model to fix TypeScript errors
type EmbeddingModel = Awaited<ReturnType<typeof pipeline>>;

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
  private embeddingModel: EmbeddingModel | null = null;
  private readonly indexName = "protocol-references";
  private initialized = false;

  constructor() {
    this.initializeServices().catch(console.error);
  }

  private async initializeServices() {
    if (!process.env.PINECONE_API_KEY) {
      console.error("Warning: PINECONE_API_KEY not set. RAG features will be disabled.");
      return;
    }

    try {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });

      this.embeddingModel = await this.initEmbeddingModel();
      this.initialized = true;
      console.log("RAG service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize RAG service:", error);
      this.initialized = false;
    }
  }

  private async initEmbeddingModel() {
    if (!this.embeddingModel) {
      try {
        return await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      } catch (error) {
        console.error("Failed to initialize embedding model:", error);
        throw error;
      }
    }
    return this.embeddingModel;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      throw new Error("RAG service not initialized");
    }

    if (!this.embeddingModel) {
      throw new Error("Embedding model not initialized");
    }

    try {
      const output = await this.embeddingModel(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      throw error;
    }
  }

  async indexDocument(doc: ReferenceDocument) {
    if (!this.initialized || !this.pinecone) {
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
        const vectors = await Promise.all(
          batch.map(async (chunk, idx) => {
            const embedding = await this.generateEmbedding(chunk);
            return {
              id: `${doc.id}-chunk-${i + idx}`,
              values: embedding,
              metadata: {
                ...doc.metadata,
                type: doc.type,
                title: doc.title,
                chunk: chunk,
                originalDocId: doc.id
              },
            };
          })
        );

        await index.upsert(vectors);
      }
    } catch (error) {
      console.error("Failed to index document:", error);
      throw error;
    }
  }

  async queryRelevantDocuments(query: string, category: string): Promise<string[]> {
    if (!this.initialized || !this.pinecone) {
      console.warn("RAG service not initialized, returning empty results");
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
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

The protocol should incorporate best practices and guidelines from the reference materials while being specifically tailored to this study.
`;
    } catch (error) {
      console.error("Failed to generate contextual prompt:", error);
      // Fallback to basic prompt without context
      return `
Generate a comprehensive research protocol for the following:

Product Name: ${productName}
Research Hypothesis: ${hypothesis}
Study Category: ${category}

The protocol should follow FDA guidelines and best practices while being specifically tailored to this study.
`;
    }
  }
}

export const ragService = new RAGService();