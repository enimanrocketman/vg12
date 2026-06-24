import type { EvidenceSource } from "../../shared/schemas.js";
import { EVIDENCE_MATCH_MIN_SCORE } from "./config.js";
import { matchBestClaim } from "./search-claims.js";

export async function matchClaimEvidenceSource(
  claim: string,
): Promise<EvidenceSource | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const match = await matchBestClaim(claim);
  if (
    !match?.sourceTag ||
    !match.sourceUrl ||
    match.score < EVIDENCE_MATCH_MIN_SCORE
  ) {
    return null;
  }

  return {
    tag: match.sourceTag,
    url: match.sourceUrl,
  };
}
