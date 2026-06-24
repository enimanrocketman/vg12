import type { ClaimChunk } from "./claim-chunks.js";
import { tokenOverlapScore } from "./token-overlap.js";

type ChunkMetadata = ClaimChunk["metadata"];

export type VectorQueryRow = {
  score?: number;
  metadata?: Record<string, unknown>;
};

export type RankedClaimMatch = {
  claimId: number;
  score: number;
  metadata: ChunkMetadata;
  chunkType: ChunkMetadata["chunkType"];
};

const CLAIM_CHUNK_BOOST = 0.05;
const REBUTTAL_CHUNK_BOOST = 0.02;
const TOKEN_MATCH_WEIGHT = 0.09;

export function rankClaimResults(
  query: string,
  results: VectorQueryRow[],
): RankedClaimMatch[] {
  const byClaimId = new Map<number, RankedClaimMatch>();

  for (const row of results) {
    const metadata = row.metadata as ChunkMetadata | undefined;
    const claimId = metadata?.claimId;
    const chunkType = metadata?.chunkType;

    if (!claimId || !chunkType || !metadata?.claim) {
      continue;
    }

    const vectorScore = row.score ?? 0;
    const chunkBoost =
      chunkType === "claim"
        ? CLAIM_CHUNK_BOOST
        : chunkType === "rebuttal"
          ? REBUTTAL_CHUNK_BOOST
          : 0;
    const overlapText = metadata.indexText ?? metadata.claim;
    const tokenBoost = tokenOverlapScore(query, overlapText) * TOKEN_MATCH_WEIGHT;
    const score = vectorScore + chunkBoost + tokenBoost;

    const existing = byClaimId.get(claimId);
    if (!existing || score > existing.score) {
      byClaimId.set(claimId, {
        claimId,
        score,
        metadata,
        chunkType,
      });
    }
  }

  return [...byClaimId.values()].sort((left, right) => right.score - left.score);
}
