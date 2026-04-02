import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { callCloudBaseFunction } from "@/lib/server/cloudbase-functions";

type TravelPlanRow = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget: string;
  preferences: string[] | null;
  itinerary_json: unknown;
  created_at: string;
};

export async function GET() {
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

    const data = await callCloudBaseFunction<TravelPlanRow[]>("toutoutool-user", {
      action: "listTravelPlans",
      userId: session.userId,
      phoneNumber: session.phoneNumber,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load travel plans.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const payload = (await request.json()) as Record<string, unknown>;

    const data = await callCloudBaseFunction<TravelPlanRow>("toutoutool-user", {
      action: "createTravelPlan",
      userId: session.userId,
      phoneNumber: session.phoneNumber,
      payload,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save travel plan.",
      },
      { status: 500 }
    );
  }
}
