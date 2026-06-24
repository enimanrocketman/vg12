import { z } from "zod";

export const OFF_TOPIC_ROAST = "i dont answer this";

export const roastRequestSchema = z.object({
  claim: z
    .string()
    .trim()
    .min(1, "Enter a claim.")
    .max(500, "Keep claims under 500 characters."),
  sessionId: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid session id.")
    .optional(),
});

export const roastOutputSchema = z.object({
  roast: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .describe("A grounded English vegan rebuttal in 10 to 20 words."),
  explanation: z
    .string()
    .trim()
    .min(20)
    .max(240)
    .describe(
      "One or two short factual sentences that expand on the rebuttal. Plain prose, no citations or source names.",
    ),
});

export const evidenceSourceSchema = z.object({
  tag: z.string().trim().min(1).max(40),
  url: z.string().trim().url(),
});

export const roastResponseSchema = z.object({
  roast: z.string().trim().min(1).max(150),
  explanation: z.string().trim().min(1).max(240),
  words: z.number().int().min(4).max(14),
  source: z.enum(["mastra", "local"]),
  evidenceSource: evidenceSourceSchema.optional(),
});

export const apiErrorSchema = z.object({
  error: z.string(),
});

export const authRequestSchema = z.object({
  password: z.string().min(1, "Enter the password."),
});

export const authResponseSchema = z.object({
  token: z.string().min(1),
});

export type RoastRequest = z.infer<typeof roastRequestSchema>;
export type RoastOutput = z.infer<typeof roastOutputSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type RoastResponse = z.infer<typeof roastResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type AuthRequest = z.infer<typeof authRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
