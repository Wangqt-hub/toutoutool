import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import {
  getTravelPlan,
  updateTravelPlan,
} from "@/lib/server/travel-plans";
import {
  type TravelPlanMutationInput,
} from "@/lib/travel/types";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const data = await getTravelPlan(session, context.params.id);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Travel plan not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load travel plan.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const input = (await request.json()) as TravelPlanMutationInput;
    const data = await updateTravelPlan(session, context.params.id, input || {});

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Travel plan not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update travel plan.",
      },
      { status: 500 }
    );
  }
}
