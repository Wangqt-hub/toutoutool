import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import type { AIGenerationHistoryItem } from "@/lib/bead/aiGeneration";
import {
  callAIService,
  CloudRunServiceError,
} from "@/lib/server/cloudrun";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

function buildHistoryItemETag(item: AIGenerationHistoryItem) {
  const seed = [
    item.id,
    item.status,
    item.updatedAt,
    item.completedAt || "",
    item.aiImageProxyUrl || "",
    item.errorMessage || "",
  ].join(":");

  return `"${Buffer.from(seed).toString("base64url")}"`;
}

export async function GET(request: NextRequest, context: RouteContext) {
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

    const item = await callAIService<AIGenerationHistoryItem | null>(
      `history/${context.params.id}`,
      {
        method: "POST",
        body: {
          userId: session.userId,
        },
      }
    );

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          error: "Generation record not found.",
        },
        { status: 404 }
      );
    }

    const etag = buildHistoryItemETag(item);

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, no-cache, must-revalidate",
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: item,
      },
      {
        headers: {
          ETag: etag,
          "Cache-Control": "private, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh AI generation status.",
      },
      {
        status:
          error instanceof CloudRunServiceError ? error.status : 500,
      }
    );
  }
}
