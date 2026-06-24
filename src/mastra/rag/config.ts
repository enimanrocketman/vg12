import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const MASTRA_DATA_DIR = resolve(process.env.MASTRA_DATA_DIR ?? ".mastra");

mkdirSync(MASTRA_DATA_DIR, { recursive: true });

function localDatabaseUrl(filename: string) {
  return `file:${resolve(MASTRA_DATA_DIR, filename)}`;
}

export const CLAIMS_VECTOR_STORE_NAME = "claimsVector";
export const CLAIMS_INDEX_NAME = "claim_rebuttals";
export const CLAIMS_VECTOR_DB_URL = localDatabaseUrl("claims-vectors.db");

export const TOPIC_VECTOR_STORE_NAME = "topicVector";
export const TOPIC_INDEX_NAME = "topic_knowledge";
export const TOPIC_VECTOR_DB_URL = localDatabaseUrl("topic-vectors.db");
export const MEMORY_DB_URL = localDatabaseUrl("vgn-memory.db");

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;
export const EMBEDDING_BATCH_SIZE = 64;

export const CLAIM_QUERY_TOP_K = 20;
export const CLAIM_RESULT_LIMIT = 5;
export const TOPIC_QUERY_TOP_K = 6;

/** Minimum ranked claim score before attaching a source citation. */
export const EVIDENCE_MATCH_MIN_SCORE = 0.6;
/** Minimum token-overlap score for source attachment without embeddings. */
export const TOKEN_EVIDENCE_MIN_SCORE = 3;
