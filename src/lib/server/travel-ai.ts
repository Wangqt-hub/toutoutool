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
    return "No external guide links were provided. Build the itinerary from the saved trip settings.";
  }

  return plan.sourceLinks
    .map((source, index) => {
      const summary =
        source.manualSummary || source.contentText || source.excerpt || source.error;

      return [
        `Source ${index + 1}:`,
        `- url: ${source.url}`,
        `- status: ${source.status}`,
        `- title: ${source.title || "unknown"}`,
        `- author: ${source.author || "unknown"}`,
        `- summary: ${summary || "none"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildPrompt(plan: TravelPlanArchive) {
  return [
    "Return exactly one JSON object with no Markdown and no explanation.",
    "The top-level JSON keys must be overview and days.",
    "days must be an array, and each day must include day, theme, and items.",
    "items must be an array, and each item must include startTime, endTime, placeName, districtOrArea, summary, transport, estimatedCost, tips, and sourceRefs.",
    "sourceRefs must be an array of strings.",
    "All narrative content must be written in Simplified Chinese.",
    "Use Chinese for overview, day themes, summaries, transport notes, cost descriptions, and tips.",
    "You may keep official foreign place names, districts, neighborhoods, attractions, restaurants, and transit stop names in English when that is more accurate or commonly used.",
    "Do not return an English-only itinerary. Even for overseas trips, the surrounding explanation must stay in Chinese.",
    "Keep the itinerary relaxed, practical, and feasible. Avoid over-scheduling.",
    "If external sources conflict, prefer the option that is more reliable, lower-friction, and easier to execute.",
    "",
    "Traveler profile:",
    `- destination: ${plan.destination}`,
    `- start date: ${plan.startDate}`,
    `- end date: ${plan.endDate}`,
    `- budget: ${getBudgetLabel(plan.budget)}`,
    `- preferences: ${plan.preferences.join(" / ") || "none"}`,
    `- notes: ${plan.notes || "none"}`,
    "",
    "Reference sources:",
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
            "You are a travel planner. Return JSON only. Keep the itinerary feasible, structured, and easy to edit. All narrative content must be in Simplified Chinese. You may keep official foreign place names, districts, attractions, restaurants, and transit stop names in English when needed for accuracy, but the rest of the itinerary must remain in Chinese.",
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
