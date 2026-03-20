import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/serverUser";
import { toAIGenerationHistoryItem } from "@/lib/bead/aiGeneration";
import { getLatestGenerations } from "@/lib/bead/aiGenerationServer";

export const runtime = "nodejs";

function buildHistoryETag(
  generations: Array<{
    id: string;
    status: string;
    updated_at: string;
    ai_image_path: string | null;
  }>
): string {
  const seed = generations
    .map(
      (generation) =>
        `${generation.id}:${generation.status}:${generation.updated_at}:${
          generation.ai_image_path || ""
        }`
    )
    .join("|");

  return `"${Buffer.from(seed || "empty").toString("base64url")}"`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const generations = await getLatestGenerations({
      supabaseAdmin,
      userId: user.id,
      limit: 10,
    });
    const etag = buildHistoryETag(generations);

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
        data: generations.map(toAIGenerationHistoryItem),
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
      { status: 500 }
    );
  }
}
