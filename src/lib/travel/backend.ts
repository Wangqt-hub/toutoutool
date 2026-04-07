import {
  type TravelPlanArchive,
  type TravelPlanMutationInput,
  type TravelPlanRow,
} from "@/lib/travel/types";
import {
  createTravelDraft,
  normalizeBudgetLevel,
  normalizePreferenceKeys,
  normalizeTravelItinerary,
  normalizeTravelPlanStatus,
  normalizeTravelSources,
} from "@/lib/travel/utils";

function parseJsonValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

export function normalizeTravelPlanArchive(row: TravelPlanRow): TravelPlanArchive {
  const draft = createTravelDraft();
  const startDate = typeof row.start_date === "string" ? row.start_date : draft.startDate;
  const endDate = typeof row.end_date === "string" ? row.end_date : draft.endDate;

  return {
    id: row.id,
    destination:
      typeof row.destination === "string" && row.destination.trim()
        ? row.destination.trim()
        : draft.destination,
    startDate,
    endDate,
    budget: normalizeBudgetLevel(row.budget),
    preferences: normalizePreferenceKeys(parseJsonValue(row.preferences)),
    notes: typeof row.notes === "string" ? row.notes : "",
    planStatus: normalizeTravelPlanStatus(row.plan_status),
    sourceLinks: normalizeTravelSources(parseJsonValue(row.source_links_json)),
    itinerary: normalizeTravelItinerary(parseJsonValue(row.itinerary_json), startDate, endDate),
    generationModel: typeof row.generation_model === "string" ? row.generation_model : "",
    generationError: typeof row.generation_error === "string" ? row.generation_error : "",
    lastGeneratedAt:
      typeof row.last_generated_at === "string" && row.last_generated_at.trim()
        ? row.last_generated_at
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTravelFunctionPayload(input: TravelPlanMutationInput) {
  return {
    ...(input.destination !== undefined
      ? { destination: input.destination.trim() }
      : {}),
    ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
    ...(input.endDate !== undefined ? { end_date: input.endDate } : {}),
    ...(input.budget !== undefined ? { budget: input.budget } : {}),
    ...(input.preferences !== undefined ? { preferences: input.preferences } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.planStatus !== undefined ? { plan_status: input.planStatus } : {}),
    ...(input.sourceLinks !== undefined
      ? { source_links_json: input.sourceLinks }
      : {}),
    ...(input.itinerary !== undefined ? { itinerary_json: input.itinerary } : {}),
    ...(input.generationModel !== undefined
      ? { generation_model: input.generationModel }
      : {}),
    ...(input.generationError !== undefined
      ? { generation_error: input.generationError }
      : {}),
    ...(input.lastGeneratedAt !== undefined
      ? { last_generated_at: input.lastGeneratedAt }
      : {}),
  };
}
