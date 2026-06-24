import { claimsAndRoasts } from "../agents/claim-bank.js";

export type ClaimChunkType = "claim" | "rebuttal" | "source";

export type ClaimChunk = {
  id: string;
  text: string;
  metadata: {
    text: string;
    chunkType: ClaimChunkType;
    claimId: number;
    categoryId: number;
    category: string;
    claim: string;
    rebuttal?: string;
    sourceTag?: string;
    sourceUrl?: string;
    indexText?: string;
  };
};

export function buildClaimChunks(): ClaimChunk[] {
  const chunks: ClaimChunk[] = [];

  for (const category of claimsAndRoasts.categories) {
    for (const item of category.claims) {
      const claimIndexText = buildClaimIndexText(item, category.category);

      chunks.push({
        id: `claim-${item.id}`,
        text: claimIndexText,
        metadata: {
          text: `Claim: ${item.claim}`,
          chunkType: "claim",
          claimId: item.id,
          categoryId: category.id,
          category: category.category,
          claim: item.claim,
          indexText: claimIndexText,
          rebuttal: item.rebuttal,
          sourceTag: item.source.tag,
          sourceUrl: item.source.url,
        },
      });

      chunks.push({
        id: `rebuttal-${item.id}`,
        text: item.rebuttal,
        metadata: {
          text: `Rebuttal to "${item.claim}": ${item.rebuttal}`,
          chunkType: "rebuttal",
          claimId: item.id,
          categoryId: category.id,
          category: category.category,
          claim: item.claim,
          rebuttal: item.rebuttal,
          sourceTag: item.source.tag,
          sourceUrl: item.source.url,
        },
      });

      chunks.push({
        id: `source-${item.id}`,
        text: `${item.source.tag} ${item.source.url}`,
        metadata: {
          text: `Source for "${item.claim}": ${item.source.tag} (${item.source.url})`,
          chunkType: "source",
          claimId: item.id,
          categoryId: category.id,
          category: category.category,
          claim: item.claim,
          rebuttal: item.rebuttal,
          sourceTag: item.source.tag,
          sourceUrl: item.source.url,
        },
      });
    }
  }

  return chunks;
}

function buildClaimIndexText(item: { id: number; claim: string }, category: string) {
  const aliases: Record<number, string> = {
    1: "Where do vegans get protein? Plant protein. Not enough protein without animal products.",
    2: "Iron only comes from meat. Plant iron lentils beans spinach.",
    3: "B12 proves veganism is unnatural or deficient. Supplements unnatural diet.",
    4: "Red meat is healthy. Saturated fat is fine.",
    5: "Vegan kids malnourished. Dangerous for children pregnant women athletes.",
    6: "Beyond meat fake meat ultra processed junk. Plant-based food overly processed.",
    7: "Humans are omnivores by design meant to eat meat.",
    8: "Eating meat is natural. It is natural to eat animals.",
    9: "Lions eat meat predators so why can't we copy nature.",
    10: "Meat built our big brains evolution.",
    11: "Canine teeth prove humans designed to eat meat anatomy.",
    13: "Animals don't feel pain consciousness feelings.",
    14: "Happy cows treated well. Happy meat. Family farm. Grass-fed local humane farming.",
    16: "Personal choice my body my choice what I eat.",
    17: "Plants feel pain too killing plants.",
    18: "Animal agriculture climate change not a big environmental problem.",
    19: "Soy destroys the amazon rainforest vegans tofu.",
    24: "Taste pleasure enjoy eating meat. Meat tastes good why I eat animals.",
    22: "Tradition culture we have always eaten meat.",
    33: "Soy gives men boobs feminizes men lowers testosterone man boobs.",
    34: "Fish oil omega-3 DHA brain health need fish.",
    38: "Cows need to be milked anyway dairy ethical.",
  };

  const alias = aliases[item.id];
  const categoryHint = `Category: ${category}.`;

  if (alias) {
    return `${item.claim} ${categoryHint} ${alias}`;
  }

  return `${item.claim} ${categoryHint}`;
}
