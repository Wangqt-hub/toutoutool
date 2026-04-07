import { type TravelPlanArchive } from "@/lib/travel/types";
import {
  getBudgetLabel,
  normalizeTravelItinerary,
} from "@/lib/travel/utils";

const DEFAULT_TRAVEL_MODEL = "qwen3.6-plus";
const DASHSCOPE_COMPATIBLE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

type DashScopeChoice = {
  message?: {
    content?: string;
  };
};

type DashScopeResponse = {
  choices?: DashScopeChoice[];
  error?: {
    message?: string;
  };
};

function getTravelModel() {
  return process.env.TRAVEL_PLAN_MODEL?.trim() || DEFAULT_TRAVEL_MODEL;
}

function getDashScopeApiKey() {
  const value = process.env.DASHSCOPE_API_KEY?.trim();

  if (!value) {
    throw new Error("DASHSCOPE_API_KEY is not configured.");
  }

  return value;
}

function summarizeSources(plan: TravelPlanArchive) {
  if (plan.sourceLinks.length === 0) {
    return "没有外部攻略链接。请基于用户设置输出可执行的行程。";
  }

  return plan.sourceLinks
    .map((source, index) => {
      const summary =
        source.manualSummary || source.contentText || source.excerpt || source.error;

      return [
        `来源${index + 1}:`,
        `- url: ${source.url}`,
        `- status: ${source.status}`,
        `- title: ${source.title || "未提取到标题"}`,
        `- author: ${source.author || "未知"}`,
        `- summary: ${summary || "无"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildPrompt(plan: TravelPlanArchive) {
  return [
    "请输出一个 JSON 对象，不要输出 Markdown，不要输出解释。",
    "JSON 顶层字段必须是 overview 和 days。",
    "days 必须是数组，每天包含 day、theme、items。",
    "items 必须是数组，每项包含 startTime、endTime、placeName、districtOrArea、summary、transport、estimatedCost、tips、sourceRefs。",
    "sourceRefs 必须是字符串数组，引用来源时使用对应来源链接或标题即可。",
    "行程要松弛、可执行，不要过度赶场。",
    "如果外部攻略存在冲突，请优先保留更稳妥、交通成本更低、节奏更顺的安排。",
    "",
    "用户档案：",
    `- 目的地: ${plan.destination}`,
    `- 出发日期: ${plan.startDate}`,
    `- 结束日期: ${plan.endDate}`,
    `- 预算: ${getBudgetLabel(plan.budget)}`,
    `- 偏好: ${plan.preferences.join(" / ") || "未填写"}`,
    `- 备注: ${plan.notes || "无"}`,
    "",
    "攻略来源：",
    summarizeSources(plan),
  ].join("\n");
}

function parseResponseContent(payload: DashScopeResponse) {
  const content = payload.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error(payload.error?.message || "Qwen did not return usable content.");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("Qwen returned invalid JSON.");
  }
}

export async function generateTravelItinerary(plan: TravelPlanArchive) {
  const response = await fetch(DASHSCOPE_COMPATIBLE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getDashScopeApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getTravelModel(),
      messages: [
        {
          role: "system",
          content:
            "You are a travel planner. Return JSON only. Keep the itinerary feasible, structured, and easy to edit.",
        },
        {
          role: "user",
          content: buildPrompt(plan),
        },
      ],
      response_format: {
        type: "json_object",
      },
      enable_thinking: false,
      temperature: 0.7,
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as DashScopeResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || "DashScope request failed.");
  }

  const parsed = parseResponseContent(payload);

  return {
    model: getTravelModel(),
    itinerary: normalizeTravelItinerary(parsed, plan.startDate, plan.endDate),
  };
}
