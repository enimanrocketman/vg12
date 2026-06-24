import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { CLAIM_RESULT_LIMIT } from "./config.js";
import { searchClaims } from "./search-claims.js";

export const claimKnowledgeTool = createTool({
  id: "search-claim-knowledge",
  description:
    "Search the vegan claim-bank for matching non-vegan claims, evidence-based rebuttals, and source references. Use this before answering to find the strongest counter-argument for the user's claim.",
  inputSchema: z.object({
    queryText: z.string().describe("The user's claim or its key terms."),
    topK: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe("How many ranked claim matches to return."),
  }),
  execute: async ({ queryText, topK }) => {
    const matches = await searchClaims(queryText, {
      limit: topK ?? CLAIM_RESULT_LIMIT,
    });

    return {
      relevantContext: matches.map((match) => ({
        claimId: match.claimId,
        category: match.category,
        claim: match.claim,
        rebuttal: match.rebuttal,
        sourceTag: match.sourceTag,
        sourceUrl: match.sourceUrl,
        matchScore: Number(match.score.toFixed(4)),
      })),
      sources: matches
        .filter((match) => match.sourceTag && match.sourceUrl)
        .map((match) => ({
          id: `claim-${match.claimId}`,
          metadata: {
            claim: match.claim,
            sourceTag: match.sourceTag,
            sourceUrl: match.sourceUrl,
          },
        })),
    };
  },
});
