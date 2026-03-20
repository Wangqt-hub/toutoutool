import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/serverUser";
import {
  type AIGenerationImageKind,
} from "@/lib/bead/aiGeneration";
import {
  downloadGenerationImage,
  getGenerationById,
} from "@/lib/bead/aiGenerationServer";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

function isImageKind(value: string | null): value is AIGenerationImageKind {
  return value === "source" || value === "ai";
}

export async function GET(request: NextRequest, context: RouteContext) {
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

    const kindParam = request.nextUrl.searchParams.get("kind");

    if (!isImageKind(kindParam)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid image kind.",
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const generation = await getGenerationById({
      supabaseAdmin,
      userId: user.id,
      generationId: context.params.id,
    });

    if (!generation) {
      return NextResponse.json(
        {
          success: false,
          error: "Generation record not found.",
        },
        { status: 404 }
      );
    }

    const path =
      kindParam === "source"
        ? generation.source_image_path
        : generation.ai_image_path;

    if (!path) {
      return NextResponse.json(
        {
          success: false,
          error: "Requested image is not available.",
        },
        { status: 404 }
      );
    }

    const image = await downloadGenerationImage({
      supabaseAdmin,
      path,
    });
    const contentType = image.type || "application/octet-stream";

    return new NextResponse(await image.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load image.",
      },
      { status: 500 }
    );
  }
}
