import { LibSQLVector } from "@mastra/libsql";

import {
  CLAIMS_INDEX_NAME,
  CLAIMS_VECTOR_DB_URL,
  CLAIMS_VECTOR_STORE_NAME,
} from "./config.js";

export const claimVectorStore = new LibSQLVector({
  id: CLAIMS_VECTOR_STORE_NAME,
  url: CLAIMS_VECTOR_DB_URL,
});

export async function describeClaimsIndex() {
  try {
    return await claimVectorStore.describeIndex({ indexName: CLAIMS_INDEX_NAME });
  } catch {
    return null;
  }
}
