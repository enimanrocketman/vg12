import { topicArticles } from "../knowledge/topic-bank.js";

const MAX_CHUNK_CHARS = 700;

export type TopicChunk = {
  id: string;
  text: string;
  metadata: {
    text: string;
    articleId: string;
    title: string;
    authors: string;
    year: number | null;
    type: string;
    url: string;
    topics: string[];
    sectionHeading: string;
    chunkIndex: number;
    chunkCount: number;
  };
};

export function buildTopicChunks(): TopicChunk[] {
  const chunks: TopicChunk[] = [];

  for (const article of topicArticles.articles) {
    for (const section of article.sections) {
      const parts = splitSectionContent(section.content);

      parts.forEach((part, chunkIndex) => {
        const text = formatChunkText(article, section.heading, part);
        const id = `${article.id}-${slugify(section.heading)}-${chunkIndex}`;

        chunks.push({
          id,
          text,
          metadata: {
            text,
            articleId: article.id,
            title: article.title,
            authors: article.authors,
            year: article.year,
            type: article.type,
            url: article.url,
            topics: article.topics,
            sectionHeading: section.heading,
            chunkIndex,
            chunkCount: parts.length,
          },
        });
      });
    }
  }

  return chunks;
}

function formatChunkText(
  article: { title: string; authors: string; year: number | null; topics: string[] },
  heading: string,
  content: string,
) {
  const year = article.year ? ` (${article.year})` : "";
  const topics = article.topics.join(", ");

  return `${article.title}${year} — ${article.authors}. Section: ${heading}. Topics: ${topics}. ${content}`;
}

function splitSectionContent(content: string) {
  if (content.length <= MAX_CHUNK_CHARS) {
    return [content];
  }

  const sentences = content.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [content];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) {
      continue;
    }

    const next = current ? `${current} ${trimmed}` : trimmed;

    if (next.length > MAX_CHUNK_CHARS && current) {
      parts.push(current);
      current = trimmed;
    } else {
      current = next;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts.length > 0 ? parts : [content];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
