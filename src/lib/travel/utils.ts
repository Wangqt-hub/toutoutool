import {
  type BudgetLevel,
  type Itinerary,
  type ItineraryDay,
  type ItineraryItem,
  type ItineraryItemKind,
  type PreferenceKey,
  type TravelPlanArchive,
  type TravelPlanStatus,
  type TravelPreferences,
  type TravelSource,
} from "@/lib/travel/types";

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `travel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function addDays(base: string | Date, days: number) {
  const date = typeof base === "string" ? new Date(base) : new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

export function getDefaultTravelDates() {
  const start = new Date();
  const end = addDays(start, 2);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
}

export function getTravelDayCount(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const diff = end.getTime() - start.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(days, 1);
}

export function buildTravelDateLabel(base: string, offset: number) {
  const date = addDays(base, offset);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDay = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
    date.getDay()
  ];

  return `${month}月${day}日 ${weekDay}`;
}

export function createEmptyItineraryItem(): ItineraryItem {
  return {
    id: createId(),
    kind: "activity",
    startTime: "",
    endTime: "",
    placeName: "",
    districtOrArea: "",
    summary: "",
    transport: "",
    estimatedCost: "",
    tips: "",
    sourceRefs: [],
  };
}

const itineraryKinds: ItineraryItemKind[] = [
  "food",
  "sightseeing",
  "activity",
  "shopping",
  "rest",
];

function normalizeItineraryKind(value: unknown) {
  return itineraryKinds.includes(value as ItineraryItemKind)
    ? (value as ItineraryItemKind)
    : null;
}

export function inferItineraryItemKind(
  value: Pick<ItineraryItem, "placeName" | "districtOrArea" | "summary" | "tips">,
  dayTheme = ""
): ItineraryItemKind {
  const text = [
    dayTheme,
    value.placeName,
    value.districtOrArea,
    value.summary,
    value.tips,
  ]
    .join(" ")
    .toLowerCase();

  const foodKeywords = [
    "餐",
    "吃",
    "咖啡",
    "甜品",
    "酒吧",
    "小吃",
    "料理",
    "火锅",
    "brunch",
    "cafe",
    "coffee",
    "bar",
  ];
  const sightseeingKeywords = [
    "景点",
    "博物",
    "美术",
    "寺",
    "塔",
    "公园",
    "神社",
    "教堂",
    "海边",
    "观景",
    "夜景",
    "展",
    "地标",
    "打卡",
  ];
  const shoppingKeywords = ["逛街", "商场", "百货", "购物", "市集", "outlet", "mall"];
  const restKeywords = ["休息", "酒店", "泡汤", "spa", "放松", "午休", "chill", "发呆"];

  if (foodKeywords.some((keyword) => text.includes(keyword))) {
    return "food";
  }

  if (shoppingKeywords.some((keyword) => text.includes(keyword))) {
    return "activity";
  }

  if (sightseeingKeywords.some((keyword) => text.includes(keyword))) {
    return "sightseeing";
  }

  if (restKeywords.some((keyword) => text.includes(keyword))) {
    return "rest";
  }

  return "activity";
}

export function createEmptyItinerary(startDate: string, endDate: string): Itinerary {
  const dayCount = getTravelDayCount(startDate, endDate);
  const days: ItineraryDay[] = [];

  for (let index = 0; index < dayCount; index += 1) {
    days.push({
      day: index + 1,
      dateLabel: buildTravelDateLabel(startDate, index),
      theme: "",
      items: [],
    });
  }

  return {
    overview: "",
    days,
  };
}

function normalizeSourceRefs(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toTravelTimeValue(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function isCompleteTravelTime(value: string) {
  return toTravelTimeValue(value) !== null;
}

export function sortTravelItineraryItems(items: ItineraryItem[]) {
  return [...items].sort((left, right) => {
    const leftStart = toTravelTimeValue(left.startTime);
    const rightStart = toTravelTimeValue(right.startTime);

    if (leftStart === null && rightStart === null) {
      return 0;
    }

    if (leftStart === null) {
      return -1;
    }

    if (rightStart === null) {
      return 1;
    }

    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    const leftEnd = toTravelTimeValue(left.endTime);
    const rightEnd = toTravelTimeValue(right.endTime);

    if (leftEnd === null && rightEnd === null) {
      return 0;
    }

    if (leftEnd === null) {
      return 1;
    }

    if (rightEnd === null) {
      return -1;
    }

    return leftEnd - rightEnd;
  });
}

export function normalizeItineraryItem(value: unknown): ItineraryItem {
  const item = (value || {}) as Partial<ItineraryItem>;
  const normalizedBase = {
    placeName: typeof item.placeName === "string" ? item.placeName.trim() : "",
    districtOrArea:
      typeof item.districtOrArea === "string" ? item.districtOrArea.trim() : "",
    summary: typeof item.summary === "string" ? item.summary.trim() : "",
    tips: typeof item.tips === "string" ? item.tips.trim() : "",
  };

  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id : createId(),
    kind:
      normalizeItineraryKind(item.kind) ||
      inferItineraryItemKind(normalizedBase),
    startTime: typeof item.startTime === "string" ? item.startTime.trim() : "",
    endTime: typeof item.endTime === "string" ? item.endTime.trim() : "",
    placeName: normalizedBase.placeName,
    districtOrArea: normalizedBase.districtOrArea,
    summary: normalizedBase.summary,
    transport: typeof item.transport === "string" ? item.transport.trim() : "",
    estimatedCost:
      typeof item.estimatedCost === "string" ? item.estimatedCost.trim() : "",
    tips: normalizedBase.tips,
    sourceRefs: normalizeSourceRefs(item.sourceRefs),
  };
}

function normalizeItineraryDay(value: unknown, startDate: string, index: number): ItineraryDay {
  const day = (value || {}) as Partial<ItineraryDay>;
  const dayTheme = typeof day.theme === "string" ? day.theme.trim() : "";
  const items = Array.isArray(day.items)
    ? sortTravelItineraryItems(
        day.items.map((item) => {
          const normalized = normalizeItineraryItem(item);

          return normalized.kind
            ? normalized
            : {
                ...normalized,
                kind: inferItineraryItemKind(normalized, dayTheme),
              };
        })
      )
    : [];

  return {
    day: index + 1,
    dateLabel:
      typeof day.dateLabel === "string" && day.dateLabel.trim()
        ? day.dateLabel.trim()
        : buildTravelDateLabel(startDate, index),
    theme: dayTheme,
    items,
  };
}

export function normalizeTravelItinerary(
  value: unknown,
  startDate: string,
  endDate: string
): Itinerary {
  const itinerary = (value || {}) as Partial<Itinerary>;
  const fallback = createEmptyItinerary(startDate, endDate);
  const targetDays = getTravelDayCount(startDate, endDate);
  const sourceDays = Array.isArray(itinerary.days) ? itinerary.days : [];
  const days: ItineraryDay[] = [];

  for (let index = 0; index < targetDays; index += 1) {
    days.push(
      normalizeItineraryDay(sourceDays[index], startDate, index)
    );
  }

  return {
    overview:
      typeof itinerary.overview === "string" ? itinerary.overview.trim() : fallback.overview,
    days,
  };
}

export function normalizeBudgetLevel(value: unknown): BudgetLevel {
  if (
    value === "unspecified" ||
    value === "low" ||
    value === "medium" ||
    value === "high"
  ) {
    return value;
  }

  return "unspecified";
}

const preferenceSet = new Set<PreferenceKey>([
  "food",
  "sightseeing",
  "shopping",
  "relax",
  "culture",
  "nightlife",
]);

export function normalizePreferenceKeys(value: unknown): TravelPreferences {
  if (!Array.isArray(value)) {
    return ["food", "sightseeing"];
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is PreferenceKey => preferenceSet.has(item as PreferenceKey));

  return normalized.length > 0 ? normalized : ["food", "sightseeing"];
}

export function normalizeTravelPlanStatus(value: unknown): TravelPlanStatus {
  if (value === "draft" || value === "generated" || value === "attention") {
    return value;
  }

  return "draft";
}

export function normalizeTravelSource(value: unknown): TravelSource {
  const source = (value || {}) as Partial<TravelSource>;

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : createId(),
    url: typeof source.url === "string" ? source.url.trim() : "",
    status: source.status === "error" ? "error" : "parsed",
    title: typeof source.title === "string" ? source.title.trim() : "",
    author: typeof source.author === "string" ? source.author.trim() : "",
    coverImage:
      typeof source.coverImage === "string" ? source.coverImage.trim() : "",
    excerpt: typeof source.excerpt === "string" ? source.excerpt.trim() : "",
    contentText:
      typeof source.contentText === "string" ? source.contentText.trim() : "",
    manualSummary:
      typeof source.manualSummary === "string" ? source.manualSummary.trim() : "",
    error: typeof source.error === "string" ? source.error.trim() : "",
    fetchedAt:
      typeof source.fetchedAt === "string" && source.fetchedAt.trim()
        ? source.fetchedAt
        : null,
  };
}

export function normalizeTravelSources(value: unknown): TravelSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeTravelSource)
    .filter((item) => Boolean(item.url || item.manualSummary || item.title));
}

export function createTravelDraft(): TravelPlanArchive {
  const { startDate, endDate } = getDefaultTravelDates();
  const now = new Date().toISOString();

  return {
    id: "",
    destination: "未命名旅程",
    startDate,
    endDate,
    budget: "unspecified",
    preferences: ["food", "sightseeing"],
    notes: "",
    planStatus: "draft",
    sourceLinks: [],
    itinerary: createEmptyItinerary(startDate, endDate),
    generationModel: "",
    generationError: "",
    lastGeneratedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getBudgetLabel(value: BudgetLevel) {
  if (value === "unspecified") {
    return "未设预算";
  }

  if (value === "low") {
    return "轻预算";
  }

  if (value === "high") {
    return "舒展";
  }

  return "平衡";
}

export function getPlanStatusLabel(status: TravelPlanStatus) {
  if (status === "generated") {
    return "已生成";
  }

  if (status === "attention") {
    return "待处理";
  }

  return "草稿";
}

export function getPlanStatusTone(status: TravelPlanStatus) {
  if (status === "generated") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "attention") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-slate-200 text-slate-700";
}

export function toEditableTravelSnapshot(plan: TravelPlanArchive) {
  return JSON.stringify({
    destination: plan.destination,
    startDate: plan.startDate,
    endDate: plan.endDate,
    budget: plan.budget,
    preferences: [...plan.preferences].sort(),
    notes: plan.notes,
    planStatus: plan.planStatus,
    sourceLinks: plan.sourceLinks.map((source) => ({
      ...source,
    })),
    itinerary: plan.itinerary,
    generationModel: plan.generationModel,
    generationError: plan.generationError,
    lastGeneratedAt: plan.lastGeneratedAt,
  });
}
