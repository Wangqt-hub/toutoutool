export type BudgetLevel = "unspecified" | "low" | "medium" | "high";

export type PreferenceKey =
  | "food"
  | "sightseeing"
  | "shopping"
  | "relax"
  | "culture"
  | "nightlife";

export type TravelPlanStatus = "draft" | "generated" | "attention";

export type TravelSourceStatus = "parsed" | "error";

export type TravelPreferences = PreferenceKey[];

export type TravelSource = {
  id: string;
  url: string;
  status: TravelSourceStatus;
  title: string;
  author: string;
  coverImage: string;
  excerpt: string;
  contentText: string;
  manualSummary: string;
  error: string;
  fetchedAt: string | null;
};

export type ItineraryItemKind =
  | "food"
  | "sightseeing"
  | "activity"
  | "shopping"
  | "rest";

export type ItineraryItem = {
  id: string;
  kind: ItineraryItemKind;
  startTime: string;
  endTime: string;
  placeName: string;
  districtOrArea: string;
  summary: string;
  transport: string;
  estimatedCost: string;
  tips: string;
  sourceRefs: string[];
};

export type ItineraryDay = {
  day: number;
  dateLabel: string;
  theme: string;
  items: ItineraryItem[];
};

export type Itinerary = {
  overview: string;
  days: ItineraryDay[];
};

export type TravelPlanArchive = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: BudgetLevel;
  preferences: TravelPreferences;
  notes: string;
  planStatus: TravelPlanStatus;
  sourceLinks: TravelSource[];
  itinerary: Itinerary;
  generationModel: string;
  generationError: string;
  lastGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TravelPlanRow = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget: string;
  preferences: unknown;
  notes: string | null;
  itinerary_json: unknown;
  plan_status: string | null;
  source_links_json: unknown;
  generation_model: string | null;
  generation_error: string | null;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TravelPlanMutationInput = Partial<
  Pick<
    TravelPlanArchive,
    | "destination"
    | "startDate"
    | "endDate"
    | "budget"
    | "preferences"
    | "notes"
    | "planStatus"
    | "sourceLinks"
    | "itinerary"
    | "generationModel"
    | "generationError"
    | "lastGeneratedAt"
  >
>;

export const TRAVEL_BUDGET_OPTIONS: {
  value: BudgetLevel;
  label: string;
  blurb: string;
}[] = [
  {
    value: "unspecified",
    label: "暂不设预算",
    blurb: "先把地点和时间定下来，之后再补预算。",
  },
  {
    value: "low",
    label: "轻预算",
    blurb: "公共交通、小店和免费景点优先。",
  },
  {
    value: "medium",
    label: "平衡",
    blurb: "效率和体验并重，预算不过度紧绷。",
  },
  {
    value: "high",
    label: "舒展",
    blurb: "更看重体验、餐饮和留白感。",
  },
];

export const TRAVEL_PREFERENCE_OPTIONS: {
  key: PreferenceKey;
  label: string;
}[] = [
  { key: "food", label: "美食" },
  { key: "sightseeing", label: "地标" },
  { key: "shopping", label: "逛街" },
  { key: "relax", label: "松弛" },
  { key: "culture", label: "展览" },
  { key: "nightlife", label: "夜游" },
];
