import type { AppSession } from "@/lib/auth/session";
import { callCloudBaseFunction } from "@/lib/server/cloudbase-functions";
import {
  normalizeTravelPlanArchive,
  toTravelFunctionPayload,
} from "@/lib/travel/backend";
import {
  type TravelPlanMutationInput,
  type TravelPlanRow,
} from "@/lib/travel/types";

function buildSessionPayload(session: AppSession) {
  return {
    userId: session.userId,
    phoneNumber: session.phoneNumber,
  };
}

export async function listTravelPlans(session: AppSession) {
  const rows = await callCloudBaseFunction<TravelPlanRow[]>("toutoutool-user", {
    action: "listTravelPlans",
    ...buildSessionPayload(session),
  });

  return rows.map(normalizeTravelPlanArchive);
}

export async function createTravelPlan(
  session: AppSession,
  input: TravelPlanMutationInput = {}
) {
  const row = await callCloudBaseFunction<TravelPlanRow>("toutoutool-user", {
    action: "createTravelPlan",
    ...buildSessionPayload(session),
    payload: toTravelFunctionPayload(input),
  });

  return normalizeTravelPlanArchive(row);
}

export async function getTravelPlan(session: AppSession, travelPlanId: string) {
  const row = await callCloudBaseFunction<TravelPlanRow | null>("toutoutool-user", {
    action: "getTravelPlan",
    ...buildSessionPayload(session),
    travelPlanId,
  });

  return row ? normalizeTravelPlanArchive(row) : null;
}

export async function updateTravelPlan(
  session: AppSession,
  travelPlanId: string,
  input: TravelPlanMutationInput
) {
  const row = await callCloudBaseFunction<TravelPlanRow | null>("toutoutool-user", {
    action: "updateTravelPlan",
    ...buildSessionPayload(session),
    travelPlanId,
    payload: toTravelFunctionPayload(input),
  });

  return row ? normalizeTravelPlanArchive(row) : null;
}

export async function deleteTravelPlan(
  session: AppSession,
  travelPlanId: string
) {
  const row = await callCloudBaseFunction<TravelPlanRow | null>("toutoutool-user", {
    action: "deleteTravelPlan",
    ...buildSessionPayload(session),
    travelPlanId,
  });

  return row ? normalizeTravelPlanArchive(row) : null;
}
