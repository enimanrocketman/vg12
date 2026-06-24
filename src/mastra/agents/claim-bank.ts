import { createRequire } from "node:module";

import type { EvidenceSource } from "../../shared/schemas.js";

export type ClaimItem = {
  id: number;
  claim: string;
  rebuttal: string;
  source: EvidenceSource;
};

export type ClaimCategory = {
  id: number;
  category: string;
  claims: ClaimItem[];
};

export type ClaimBank = {
  title: string;
  description: string;
  total_claims: number;
  categories: ClaimCategory[];
};

const require = createRequire(import.meta.url);

export const claimsAndRoasts = require("./claims_and_roasts.json") as ClaimBank;
