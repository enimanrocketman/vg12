import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type TopicArticleType = "paper" | "article" | "report" | "declaration";

export type TopicSection = {
  heading: string;
  content: string;
};

export type TopicArticle = {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  type: TopicArticleType;
  url: string;
  topics: string[];
  sections: TopicSection[];
};

export type TopicBank = {
  title: string;
  description: string;
  articles: TopicArticle[];
};

export const topicArticles = require("./topic-articles.json") as TopicBank;
