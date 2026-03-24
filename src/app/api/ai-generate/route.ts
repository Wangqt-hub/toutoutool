import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/serverUser";
import {
  type AIGenerationHistoryItem,
} from "@/lib/bead/aiGeneration";
import {
  buildAIGenerationHistoryItem,
  buildSourceImagePath,
  createDashScopeAsyncTask,
  createSignedStorageUrl,
  getActiveGeneration,
  getProgressForStatus,
  getStyleSelection,
  insertGeneration,
  pruneOldGenerations,
  updateGeneration,
  uploadGenerationImageVariants,
  uploadStorageObject,
} from "@/lib/bead/aiGenerationServer";

export const runtime = "nodejs";

async function serializeGeneration(options: {
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  generation: Awaited<ReturnType<typeof getActiveGeneration>>;
}): Promise<AIGenerationHistoryItem | null> {
  if (!options.generation) {
    return null;
  }

  return buildAIGenerationHistoryItem({
    supabaseAdmin: options.supabaseAdmin,
    row: options.generation,
  });
}

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
  const supabaseAdmin = createSupabaseAdminClient();
  let generationId = "";
  let userId = "";

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

    userId = user.id;

    const activeGeneration = await getActiveGeneration({
      supabaseAdmin,
      userId,
    });

    if (activeGeneration) {
      const activeItem = await serializeGeneration({
        supabaseAdmin,
        generation: activeGeneration,
      });

      return conflictResponse(
        "You already have an AI generation in progress.",
        activeItem
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

    generationId = crypto.randomUUID();
    const { prompt, styleName } = getStyleSelection(styleId, customPrompt);
    const sourceImagePath = buildSourceImagePath(userId, generationId, image);

    let generation = await insertGeneration({
      supabaseAdmin,
      row: {
        id: generationId,
        user_id: userId,
        style_id: styleId,
        style_name: styleName,
        prompt,
        status: "UPLOADING_SOURCE",
        progress_percent: getProgressForStatus("UPLOADING_SOURCE"),
        source_image_path: sourceImagePath,
        ai_image_path: null,
        dashscope_task_id: null,
        error_message: null,
        completed_at: null,
      },
    });

    try {
      const sourceBuffer = new Uint8Array(await image.arrayBuffer());

      await uploadStorageObject({
        supabaseAdmin,
        path: sourceImagePath,
        body: sourceBuffer,
        contentType: image.type || "image/png",
      });

      try {
        await uploadGenerationImageVariants({
          supabaseAdmin,
          userId,
          generationId,
          kind: "source",
          sourceBuffer,
        });
      } catch {
        // Variant uploads are best-effort and should not fail the main task.
      }

      const sourceImageUrl = await createSignedStorageUrl({
        supabaseAdmin,
        path: sourceImagePath,
      });

      const task = await createDashScopeAsyncTask({
        imageInput: sourceImageUrl,
        prompt,
      });

      generation = await updateGeneration({
        supabaseAdmin,
        generationId,
        userId,
        updates: {
          status: task.status,
          progress_percent: getProgressForStatus(task.status),
          dashscope_task_id: task.taskId,
          error_message: null,
        },
      });
    } catch (error) {
      generation = await updateGeneration({
        supabaseAdmin,
        generationId,
        userId,
        updates: {
          status: "FAILED",
          progress_percent: getProgressForStatus("FAILED"),
          error_message:
            error instanceof Error
              ? error.message
              : "Failed to start AI generation.",
          completed_at: new Date().toISOString(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: generation.error_message,
          data: await serializeGeneration({
            supabaseAdmin,
            generation,
          }),
        },
        { status: 500 }
      );
    }

    await pruneOldGenerations({
      supabaseAdmin,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: await serializeGeneration({
        supabaseAdmin,
        generation,
      }),
    });
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (
        message.includes("idx_bead_ai_generations_user_active") ||
        message.includes("duplicate key")
      ) {
        return conflictResponse(
          "You already have an AI generation in progress."
        );
      }
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
