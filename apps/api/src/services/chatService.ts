import type { ChatRequest, ChatResponse, Language } from "@dotagame/contracts";
import { generateRagAnswer } from "./rag/llmProvider.js";
import { retrieveRagContext } from "./rag/ragService.js";

function buildFallback(language: Language): ChatResponse {
  const answerByLanguage: Record<Language, string> = {
    "zh-CN":
      "I could not find a direct answer in the current index. Share your hero, role, or a specific in-game issue for more targeted help.",
    "en-US":
      "I could not find a direct answer in the current index. Share your hero, role, or a specific in-game issue for more targeted help."
  };

  return {
    answer: answerByLanguage[language],
    citations: [],
    confidence: 0.2,
    followUps: [
      "Which heroes do you play most?",
      "Are you playing solo queue or party queue?",
      "Do you want to improve laning, farming, or teamfighting?"
    ]
  };
}

export async function answerChat(request: ChatRequest): Promise<ChatResponse> {
  const ragContext = await retrieveRagContext({
    question: request.question,
    language: request.language,
    limit: 4
  });
  if (ragContext.matches.length === 0) {
    return buildFallback(request.language);
  }

  const llmAnswer = await generateRagAnswer({
    question: request.question,
    mode: request.mode,
    language: request.language,
    context: request.context,
    matches: ragContext.matches
  });

  return {
    answer: llmAnswer.answer,
    citations: ragContext.citations,
    confidence: llmAnswer.confidence,
    followUps: llmAnswer.followUps
  };
}
