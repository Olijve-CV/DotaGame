import type {
  AgentRunEntity
} from "../../repo/agentStore.js";
import type {
  AgentApprovalPolicy,
  AgentKind,
  AgentThreadDetail,
  ChatCitation,
  ChatMode,
  Language
} from "@dotagame/contracts";
import {
  addAgentApproval,
  addAgentMessage,
  addAgentRunStep,
  appendAgentResearchPacket,
  buildAgentThreadDetail,
  createAgentRun,
  createAgentThread,
  getAgentRun,
  getAgentThread,
  listAgentThreadSummaries,
  resolveAgentApproval,
  saveAgentRun,
  updateAgentThreadTitle
} from "../../repo/agentStore.js";
import { addChatSession } from "../../repo/inMemoryStore.js";
import { logger } from "../../lib/logger.js";
import { runKnowledgeSearch, runWebSearch } from "./agentTools.js";

function getCopy(language: Language) {
  if (language === "zh-CN") {
    return {
      waitingSummary: "等待你批准联网搜索后继续。",
      completedSummary: "多智能体任务已完成。",
      rejectedSummary: "已跳过联网搜索，基于本地知识继续完成。",
      titleFallback: "新的 Agent 线程",
      planTitle: "Orchestrator 制定计划",
      delegateTitle: "子 Agent 分工",
      knowledgeTitle: "Researcher 检索知识库",
      webTitle: "Researcher 联网搜索",
      approvalTitle: "等待人工确认",
      finalTitle: "Coach 输出结论",
      approvalReason: "这一步需要联网访问近期资料，先请求你的确认。",
      finalPrefix: "任务结论",
      nextActions: "建议下一步",
      sources: "依据来源",
      skippedWeb: "联网搜索被拒绝，本轮仅基于本地知识与现有资料生成。"
    };
  }

  return {
    waitingSummary: "Waiting for your approval before using live web search.",
    completedSummary: "Multi-agent run completed.",
    rejectedSummary: "Live web search was skipped and the run continued with local knowledge.",
    titleFallback: "New Agent Thread",
    planTitle: "Orchestrator planning",
    delegateTitle: "Subagent delegation",
    knowledgeTitle: "Researcher knowledge search",
    webTitle: "Researcher live web search",
    approvalTitle: "Waiting for human approval",
    finalTitle: "Coach final synthesis",
    approvalReason: "This step needs live web access for recent information, so approval is required.",
    finalPrefix: "Mission result",
    nextActions: "Recommended next actions",
    sources: "Sources",
    skippedWeb: "Live web search was rejected, so this run used the local knowledge base only."
  };
}

function buildThreadTitle(message: string, language: Language): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return getCopy(language).titleFallback;
  }

  return trimmed.slice(0, 44);
}

function needsWebSearch(question: string): boolean {
  const lower = question.toLowerCase();
  return [
    "latest",
    "recent",
    "today",
    "current",
    "meta",
    "patch",
    "tournament",
    "roster",
    "news",
    "version",
    "7.",
    "最近",
    "最新",
    "今天",
    "当前",
    "版本",
    "补丁",
    "赛事",
    "新闻",
    "阵容"
  ].some((term) => lower.includes(term));
}

function summarizePlan(question: string, mode: ChatMode, language: Language): string {
  if (language === "zh-CN") {
    return `目标：分析用户问题“${question}”，先由 Researcher 拉取知识，再按需要联网，最后由 Coach 输出${mode === "coach" ? "训练建议" : "简明结论"}。`;
  }

  return `Goal: analyze "${question}", let the researcher gather knowledge first, use live web search if needed, then let the coach produce a ${mode === "coach" ? "coaching-oriented" : "concise"} answer.`;
}

function formatCitationList(citations: ChatCitation[]): string {
  return citations
    .slice(0, 4)
    .map((citation, index) => `${index + 1}. ${citation.title} (${citation.source})`)
    .join("\n");
}

function buildFinalAnswer(run: AgentRunEntity, language: Language): string {
  const copy = getCopy(language);
  const knowledgePacket = run.researchPackets.find((packet) => packet.tool === "knowledge_search");
  const webPacket = run.researchPackets.find((packet) => packet.tool === "web_search");
  const lines: string[] = [
    `${copy.finalPrefix}: ${run.question}`,
    "",
    knowledgePacket?.summary ?? copy.skippedWeb
  ];

  if (webPacket) {
    lines.push("", webPacket.summary);
  } else if (run.approvals.some((approval) => approval.status === "rejected")) {
    lines.push("", copy.skippedWeb);
  }

  lines.push(
    "",
    `${copy.nextActions}:`,
    run.mode === "coach"
      ? language === "zh-CN"
        ? "1. 先把问题拆成对线、节奏、团战三个阶段分别复盘。"
        : "1. Break the issue into lane, timing, and teamfight phases before making changes."
      : language === "zh-CN"
        ? "1. 先确认这是不是版本或近期赛事导致的时间敏感问题。"
        : "1. Confirm whether this is time-sensitive and depends on the latest patch or tournament meta.",
    language === "zh-CN"
      ? "2. 如果要继续深入，可以补充你的英雄、分路、分段和具体时间点。"
      : "2. Add your hero, lane, rank, and timing window if you want a sharper follow-up.",
    language === "zh-CN"
      ? "3. 用下方来源继续追问具体版本、英雄或阵容细节。"
      : "3. Use the sources below to ask follow-ups about a patch, hero, or draft detail."
  );

  if (run.citations.length > 0) {
    lines.push("", `${copy.sources}:`, formatCitationList(run.citations));
  }

  return lines.join("\n");
}

function setRunStatus(run: AgentRunEntity, status: AgentRunEntity["status"], summary: string) {
  run.status = status;
  run.summary = summary;
  saveAgentRun(run);
}

async function continueRun(
  run: AgentRunEntity,
  options: {
    allowWebSearch: boolean;
    approvalResolved?: boolean;
    skipWebReason?: string;
  }
): Promise<AgentThreadDetail> {
  const copy = getCopy(run.language);

  if (run.researchPackets.length === 0) {
    addAgentRunStep(run.id, {
      type: "plan",
      status: "completed",
      agent: "orchestrator",
      title: copy.planTitle,
      detail: summarizePlan(run.question, run.mode, run.language)
    });

    addAgentRunStep(run.id, {
      type: "delegate",
      status: "completed",
      agent: "orchestrator",
      title: copy.delegateTitle,
      detail:
        run.mode === "coach"
          ? run.language === "zh-CN"
            ? "Orchestrator 把资料搜集交给 Researcher，把解释与建议交给 Coach。"
            : "The orchestrator assigns evidence gathering to the researcher and synthesis to the coach."
          : run.language === "zh-CN"
            ? "Orchestrator 把事实搜集交给 Researcher，再由 Coach 整理成简洁答复。"
            : "The orchestrator assigns fact finding to the researcher, then asks the coach for a concise answer."
    });

    const knowledgeResult = await runKnowledgeSearch(run.question, run.language);
    appendAgentResearchPacket(run.id, {
      tool: "knowledge_search",
      summary: knowledgeResult.summary,
      citations: knowledgeResult.citations
    });
    addAgentRunStep(run.id, {
      type: "tool_call",
      status: "completed",
      agent: "researcher",
      title: copy.knowledgeTitle,
      detail: knowledgeResult.summary,
      toolCall: {
        id: `${run.id}:knowledge_search`,
        tool: "knowledge_search",
        status: "completed",
        requiresApproval: false,
        inputSummary: run.question,
        outputSummary: knowledgeResult.summary,
        citations: knowledgeResult.citations
      }
    });
  }

  if (needsWebSearch(run.question)) {
    if (!options.allowWebSearch && !options.approvalResolved) {
      addAgentApproval(run.id, {
        tool: "web_search",
        reason: copy.approvalReason,
        inputSummary: run.question
      });
      addAgentRunStep(run.id, {
        type: "approval",
        status: "waiting",
        agent: "orchestrator",
        title: copy.approvalTitle,
        detail: copy.approvalReason
      });
      const pendingRun = getAgentRun(run.id);
      if (!pendingRun) {
        throw new Error("RUN_NOT_FOUND");
      }
      pendingRun.pendingTool = "web_search";
      pendingRun.pendingToolInput = run.question;
      pendingRun.pendingToolReason = copy.approvalReason;
      setRunStatus(pendingRun, "waiting_approval", copy.waitingSummary);
      const waitingDetail = buildAgentThreadDetail(run.threadId);
      if (!waitingDetail) {
        throw new Error("THREAD_NOT_FOUND");
      }
      return waitingDetail;
    }

    if (options.allowWebSearch) {
      const alreadyRanWebSearch = run.researchPackets.some((packet) => packet.tool === "web_search");
      if (!alreadyRanWebSearch) {
        const webResult = await runWebSearch(run.question, run.language);
        appendAgentResearchPacket(run.id, {
          tool: "web_search",
          summary: webResult.summary,
          citations: webResult.citations
        });
        addAgentRunStep(run.id, {
          type: "tool_call",
          status: "completed",
          agent: "researcher",
          title: copy.webTitle,
          detail: webResult.summary,
          toolCall: {
            id: `${run.id}:web_search`,
            tool: "web_search",
            status: "completed",
            requiresApproval: run.approvalPolicy === "always",
            inputSummary: run.question,
            outputSummary: webResult.summary,
            citations: webResult.citations
          }
        });
      }
    } else if (options.skipWebReason) {
      addAgentRunStep(run.id, {
        type: "tool_call",
        status: "completed",
        agent: "researcher",
        title: copy.webTitle,
        detail: options.skipWebReason,
        toolCall: {
          id: `${run.id}:web_search:skipped`,
          tool: "web_search",
          status: "completed",
          requiresApproval: true,
          inputSummary: run.question,
          outputSummary: options.skipWebReason,
          citations: []
        }
      });
    }
  }

  const finalAnswer = buildFinalAnswer(getAgentRun(run.id) ?? run, run.language);
  const latestRun = getAgentRun(run.id);
  if (!latestRun) {
    throw new Error("RUN_NOT_FOUND");
  }
  latestRun.finalAnswer = finalAnswer;
  latestRun.pendingTool = null;
  latestRun.pendingToolInput = null;
  latestRun.pendingToolReason = null;
  saveAgentRun(latestRun);
  addAgentRunStep(latestRun.id, {
    type: "final",
    status: "completed",
    agent: "coach",
    title: copy.finalTitle,
    detail: finalAnswer
  });
  addAgentMessage({
    threadId: latestRun.threadId,
    runId: latestRun.id,
    role: "assistant",
    agent: "coach",
    content: finalAnswer
  });
  const completedRun = getAgentRun(latestRun.id);
  if (!completedRun) {
    throw new Error("RUN_NOT_FOUND");
  }
  setRunStatus(completedRun, "completed", copy.completedSummary);

  if (completedRun.userId) {
    addChatSession({
      userId: completedRun.userId,
      question: completedRun.question,
      answer: finalAnswer,
      mode: completedRun.mode,
      language: completedRun.language
    });
  }

  const detail = buildAgentThreadDetail(completedRun.threadId);
  if (!detail) {
    throw new Error("THREAD_NOT_FOUND");
  }
  return detail;
}

export function createThread(input: {
  userId: string | null;
  language: Language;
  title?: string;
}) {
  return createAgentThread(input);
}

export function getThreadDetail(threadId: string): AgentThreadDetail | null {
  return buildAgentThreadDetail(threadId);
}

export function listThreads(userId: string) {
  return listAgentThreadSummaries(userId);
}

export async function startAgentRun(input: {
  threadId: string;
  userId: string | null;
  message: string;
  mode: ChatMode;
  language: Language;
  approvalPolicy: AgentApprovalPolicy;
}): Promise<AgentThreadDetail> {
  const thread = getAgentThread(input.threadId);
  if (!thread) {
    throw new Error("THREAD_NOT_FOUND");
  }

  const trimmedMessage = input.message.trim();
  if (trimmedMessage.length === 0) {
    throw new Error("INVALID_MESSAGE");
  }

  updateAgentThreadTitle(input.threadId, buildThreadTitle(trimmedMessage, input.language));
  addAgentMessage({
    threadId: input.threadId,
    runId: null,
    role: "user",
    agent: null,
    content: trimmedMessage
  });

  const run = createAgentRun({
    threadId: input.threadId,
    userId: input.userId,
    question: trimmedMessage,
    mode: input.mode,
    language: input.language,
    approvalPolicy: input.approvalPolicy,
    summary:
      input.language === "zh-CN" ? "Agent 正在处理请求。" : "The agent is processing the request."
  });

  logger.info("agent run started", {
    event: "agent.run.started",
    threadId: input.threadId,
    runId: run.id,
    mode: input.mode,
    language: input.language,
    approvalPolicy: input.approvalPolicy
  });

  return continueRun(run, {
    allowWebSearch: input.approvalPolicy === "auto"
  });
}

export async function resolveApprovalAndContinue(input: {
  runId: string;
  approvalId: string;
  decision: "approve" | "reject";
}): Promise<AgentThreadDetail> {
  const run = getAgentRun(input.runId);
  if (!run) {
    throw new Error("RUN_NOT_FOUND");
  }

  resolveAgentApproval(
    input.runId,
    input.approvalId,
    input.decision === "approve" ? "approved" : "rejected"
  );

  const latestRun = getAgentRun(input.runId);
  if (!latestRun) {
    throw new Error("RUN_NOT_FOUND");
  }

  latestRun.status = "running";
  saveAgentRun(latestRun);
  addAgentRunStep(input.runId, {
    type: "approval",
    status: "completed",
    agent: "orchestrator",
    title: getCopy(latestRun.language).approvalTitle,
    detail:
      input.decision === "approve"
        ? latestRun.language === "zh-CN"
          ? "已批准联网搜索，Agent 继续执行。"
          : "Live web search approved. The agent is resuming the run."
        : latestRun.language === "zh-CN"
          ? "已拒绝联网搜索，Agent 将基于现有知识继续。"
          : "Live web search rejected. The agent will continue with existing knowledge."
  });
  const resumedRun = getAgentRun(input.runId);
  if (!resumedRun) {
    throw new Error("RUN_NOT_FOUND");
  }

  if (input.decision === "reject") {
    return continueRun(resumedRun, {
      allowWebSearch: false,
      approvalResolved: true,
      skipWebReason: getCopy(resumedRun.language).rejectedSummary
    });
  }

  return continueRun(resumedRun, {
    allowWebSearch: true,
    approvalResolved: true
  });
}
