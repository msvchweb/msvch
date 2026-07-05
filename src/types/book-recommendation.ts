import type { PromptBuilderInput } from "@/lib/poster-prompts";

export interface BookSourceData {
  sourceUrl: string;
  provider: "yes24";
  productId: string;
  title: string;
  author: string;
  publisher: string;
  publishedDate?: string;
  pageInfo?: string;
  categoryPath: string[];
  coverImageUrl?: string;
  description?: string;
  tableOfContents?: string;
  authorBio?: string;
  publisherReview?: string;
  quotes?: string[];
}

export interface BookRecommendationDraft {
  noticeTitle: string;
  noticeContent: string;
  posterTitle: string;
  posterSubtitle: string;
  recommendationPoints: string[];
  discussionQuestions: string[];
  imageConcept: string;
  posterPromptInput: PromptBuilderInput;
}
