import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import type {
  AIGenerationImageKind,
  AIGenerationImageVariant,
} from "@/lib/bead/aiGeneration";
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

function isImageKind(value: string | null): value is AIGenerationImageKind {
  return value === "source" || value === "ai";
}

function isImageVariant(value: string | null): value is AIGenerationImageVariant {
  return value === "original" || value === "display" || value === "thumb";
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

    const kind = request.nextUrl.searchParams.get("kind");
    const variantParam = request.nextUrl.searchParams.get("variant");
    const variant = isImageVariant(variantParam) ? variantParam : "original";

    if (!isImageKind(kind)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid image kind.",
        },
        { status: 400 }
      );
    }

    const payload = await callAIService<{
      contentType: string;
      etag: string;
      dataBase64: string;
    }>(`history/${context.params.id}/image`, {
      method: "POST",
      body: {
        userId: session.userId,
        kind,
        variant,
      },
    });

    if (request.headers.get("if-none-match") === payload.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: payload.etag,
          "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    return new NextResponse(Buffer.from(payload.dataBase64, "base64"), {
      headers: {
        "Content-Type": payload.contentType || "application/octet-stream",
        ETag: payload.etag,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load image.",
      },
      {
        status:
          error instanceof CloudRunServiceError ? error.status : 500,
      }
    );
  }
}
