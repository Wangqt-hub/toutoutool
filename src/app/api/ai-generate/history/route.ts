import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/serverUser";
import { toAIGenerationHistoryItem } from "@/lib/bead/aiGeneration";
import { getLatestGenerations } from "@/lib/bead/aiGenerationServer";

export const runtime = "nodejs";

export async function GET() {
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

    return NextResponse.json({
      success: true,
      data: generations.map(toAIGenerationHistoryItem),
    });
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
