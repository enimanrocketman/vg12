import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { embed } from "ai";

import type { ClaimChunk } from "./claim-chunks.js";
import { rankClaimResults, type RankedClaimMatch } from "./claim-ranking.js";
import { CLAIMS_INDEX_NAME, CLAIM_QUERY_TOP_K, EMBEDDING_MODEL } from "./config.js";
import { claimVectorStore } from "./claim-vector-store.js";

type ChunkMetadata = ClaimChunk["metadata"];

export type ClaimSearchMatch = RankedClaimMatch & {
  claim: string;
  rebuttal?: string;
  sourceTag?: string;
  sourceUrl?: string;
  category: string;
};

export async function searchClaims(
  query: string,
  options: { limit?: number; topK?: number } = {},
): Promise<ClaimSearchMatch[]> {
  const limit = options.limit ?? 5;
  const topK = options.topK ?? CLAIM_QUERY_TOP_K;

  const model = new ModelRouterEmbeddingModel(EMBEDDING_MODEL);
  const { embedding } = await embed({ model, value: query });
  const results = await claimVectorStore.query({
    indexName: CLAIMS_INDEX_NAME,
    queryVector: embedding,
    topK,
  });

  const ranked = rankClaimResults(query, results);
  const metadataByClaimId = collectMetadataByClaimId(results);

  return ranked.slice(0, limit).map((match) => {
    const merged = metadataByClaimId.get(match.claimId);
    const metadata = merged ?? match.metadata;

    return {
      ...match,
      claim: metadata.claim,
      rebuttal: metadata.rebuttal,
      sourceTag: metadata.sourceTag,
      sourceUrl: metadata.sourceUrl,
      category: metadata.category,
    };
  });
}

export async function matchBestClaim(
  query: string,
): Promise<ClaimSearchMatch | null> {
  const [best] = await searchClaims(query, { limit: 1 });
  return best ?? null;
}

function collectMetadataByClaimId(results: Awaited<ReturnType<typeof claimVectorStore.query>>) {
  const metadataByClaimId = new Map<number, ChunkMetadata>();

  for (const row of results) {
    const metadata = row.metadata as ChunkMetadata | undefined;
    if (!metadata?.claimId) {
      continue;
    }

    const existing = metadataByClaimId.get(metadata.claimId);
    if (!existing) {
      metadataByClaimId.set(metadata.claimId, { ...metadata });
      continue;
    }

    metadataByClaimId.set(metadata.claimId, {
      ...existing,
      rebuttal: existing.rebuttal ?? metadata.rebuttal,
      sourceTag: existing.sourceTag ?? metadata.sourceTag,
      sourceUrl: existing.sourceUrl ?? metadata.sourceUrl,
      indexText: existing.indexText ?? metadata.indexText,
    });
  }

  return metadataByClaimId;
}
