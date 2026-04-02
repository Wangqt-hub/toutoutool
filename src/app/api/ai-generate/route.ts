import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import {
  type AIGenerationHistoryItem,
} from "@/lib/bead/aiGeneration";
import {
  callAIService,
  CloudRunServiceError,
} from "@/lib/server/cloudrun";

export const runtime = "nodejs";

function conflictResponse(message: string, item?: AIGenerationHistoryItem | null) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      data: item ?? null,
    },
    { status: 409 }
  );
}

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const image = formData.get("image");
    const styleId = String(formData.get("styleId") || "");
    const customPrompt = String(formData.get("customPrompt") || "");

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing source image.",
        },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const item = await callAIService<AIGenerationHistoryItem>("generate", {
      method: "POST",
      body: {
        userId: session.userId,
        phoneNumber: session.phoneNumber,
        styleId,
        customPrompt,
        fileName: image.name,
        contentType: image.type || "image/png",
        imageBase64: imageBuffer.toString("base64"),
      },
    });

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof CloudRunServiceError) {
      if (error.status === 409) {
        return conflictResponse(
          error.message,
          (error.data as AIGenerationHistoryItem | null | undefined) ?? null
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          data: error.data ?? null,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create AI generation.",
      },
      { status: 500 }
    );
  }
}
