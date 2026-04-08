import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { generateTravelItinerary } from "@/lib/server/travel-ai";
import {
  getTravelPlan,
  updateTravelPlan,
} from "@/lib/server/travel-plans";
import { normalizeTravelItinerary } from "@/lib/travel/utils";

type RouteContext = {
  params: {
    id: string;
  };
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext) {
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

    const current = await getTravelPlan(session, context.params.id);

    if (!current) {
      return NextResponse.json(
        {
          success: false,
          error: "Travel plan not found.",
        },
        { status: 404 }
      );
    }

    const destination = current.destination.trim();

    if (!destination || destination === "未命名旅程") {
      return NextResponse.json(
        {
          success: false,
          error: "请先填写旅行地点，再开始生成。",
        },
        { status: 400 }
      );
    }

    const { model, itinerary } = await generateTravelItinerary(current);
    const normalizedItinerary = normalizeTravelItinerary(
      itinerary,
      current.startDate,
      current.endDate
    );
    const now = new Date().toISOString();

    const updated = await updateTravelPlan(session, context.params.id, {
      itinerary: normalizedItinerary,
      planStatus: "generated",
      generationModel: model,
      generationError: "",
      lastGeneratedAt: now,
    });

    if (!updated) {
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
      data: updated,
    });
  } catch (error) {
    try {
      const session = await getServerSession();

      if (session) {
        await updateTravelPlan(session, context.params.id, {
          planStatus: "attention",
          generationError:
            error instanceof Error ? error.message : "Travel generation failed.",
        });
      }
    } catch {
      // Ignore follow-up persistence failures and return the original generation error.
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate travel itinerary.",
      },
      { status: 500 }
    );
  }
}
