import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import {
  getTravelPlan,
  updateTravelPlan,
} from "@/lib/server/travel-plans";
import { parseTravelSource } from "@/lib/server/travel-sources";

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
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

    const body = (await request.json()) as {
      url?: string;
    };
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "Source url is required.",
        },
        { status: 400 }
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

    const parsedSource = await parseTravelSource(url);
    const existingIndex = current.sourceLinks.findIndex(
      (item) => item.url === parsedSource.url || item.url === url
    );
    const nextSources = [...current.sourceLinks];

    if (existingIndex >= 0) {
      nextSources.splice(existingIndex, 1, parsedSource);
    } else {
      nextSources.unshift(parsedSource);
    }

    const data = await updateTravelPlan(session, context.params.id, {
      sourceLinks: nextSources,
      planStatus:
        parsedSource.status === "error" ? "attention" : current.planStatus,
      generationError:
        parsedSource.status === "error"
          ? "One or more source links could not be parsed. Add a manual summary or replace the link."
          : current.generationError,
    });

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
          error instanceof Error ? error.message : "Failed to parse source link.",
      },
      { status: 500 }
    );
  }
}
