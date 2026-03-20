import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/serverUser";
import {
  isAIGenerationTerminal,
  toAIGenerationHistoryItem,
} from "@/lib/bead/aiGeneration";
import {
  fetchDashScopeTask,
  getDashScopeErrorMessage,
  getProgressForStatus,
  getDashScopeResultImageUrl,
  getGenerationById,
  mapDashScopeTaskStatus,
  updateGeneration,
  uploadAIResultFromUrl,
} from "@/lib/bead/aiGenerationServer";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: NextRequest, context: RouteContext) {
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
    const generationId = context.params.id;

    let generation = await getGenerationById({
      supabaseAdmin,
      userId: user.id,
      generationId,
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

    if (isAIGenerationTerminal(generation.status)) {
      return NextResponse.json({
        success: true,
        data: toAIGenerationHistoryItem(generation),
      });
    }

    if (!generation.dashscope_task_id) {
      generation = await updateGeneration({
        supabaseAdmin,
        generationId,
        userId: user.id,
        updates: {
          status: "FAILED",
          progress_percent: getProgressForStatus("FAILED"),
          error_message: "Missing DashScope task id.",
          completed_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        data: toAIGenerationHistoryItem(generation),
      });
    }

    const taskPayload = await fetchDashScopeTask(generation.dashscope_task_id);
    const taskStatus = mapDashScopeTaskStatus(
      taskPayload.output?.task_status || generation.status
    );

    if (taskStatus === "PENDING" || taskStatus === "RUNNING") {
      generation = await updateGeneration({
        supabaseAdmin,
        generationId,
        userId: user.id,
        updates: {
          status: taskStatus,
          progress_percent: getProgressForStatus(taskStatus),
          error_message: null,
        },
      });

      return NextResponse.json({
        success: true,
        data: toAIGenerationHistoryItem(generation),
      });
    }

    if (taskStatus === "FAILED") {
      generation = await updateGeneration({
        supabaseAdmin,
        generationId,
        userId: user.id,
        updates: {
          status: "FAILED",
          progress_percent: getProgressForStatus("FAILED"),
          error_message: getDashScopeErrorMessage(
            taskPayload,
            "DashScope generation failed."
          ),
          completed_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        data: toAIGenerationHistoryItem(generation),
      });
    }

    generation = await updateGeneration({
      supabaseAdmin,
      generationId,
      userId: user.id,
      updates: {
        status: "SAVING_RESULT",
        progress_percent: getProgressForStatus("SAVING_RESULT"),
        error_message: null,
      },
    });

    const resultImageUrl = getDashScopeResultImageUrl(taskPayload);

    if (!resultImageUrl) {
      generation = await updateGeneration({
        supabaseAdmin,
        generationId,
        userId: user.id,
        updates: {
          status: "FAILED",
          progress_percent: getProgressForStatus("FAILED"),
          error_message: "DashScope task succeeded but did not return an image.",
          completed_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        data: toAIGenerationHistoryItem(generation),
      });
    }

    const aiImagePath = await uploadAIResultFromUrl({
      supabaseAdmin,
      imageUrl: resultImageUrl,
      userId: user.id,
      generationId,
    });

    generation = await updateGeneration({
      supabaseAdmin,
      generationId,
      userId: user.id,
      updates: {
        status: "SUCCEEDED",
        progress_percent: getProgressForStatus("SUCCEEDED"),
        ai_image_path: aiImagePath,
        error_message: null,
        completed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: toAIGenerationHistoryItem(generation),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh AI generation status.",
      },
      { status: 500 }
    );
  }
}
