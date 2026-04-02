import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import type { AIGenerationHistoryItem } from "@/lib/bead/aiGeneration";
import {
  callAIService,
  CloudRunServiceError,
} from "@/lib/server/cloudrun";

export const runtime = "nodejs";
const HISTORY_ETAG_VERSION = "v3-cloudbase";

function buildHistoryETag(items: AIGenerationHistoryItem[]): string {
  const seed = items
    .map(
      (item) =>
        `${item.id}:${item.status}:${item.updatedAt}:${item.aiImageProxyUrl || ""}`
    )
    .join("|");

  return `"${Buffer.from(`${HISTORY_ETAG_VERSION}:${seed || "empty"}`).toString(
    "base64url"
  )}"`;
}

export async function GET(request: NextRequest) {
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

    const items = await callAIService<AIGenerationHistoryItem[]>("history", {
      method: "POST",
      body: {
        userId: session.userId,
      },
    });
    const etag = buildHistoryETag(items);

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
        data: items,
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
            : "Failed to load AI generation history.",
      },
      {
        status:
          error instanceof CloudRunServiceError ? error.status : 500,
      }
    );
  }
}
