import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/serverUser";
import {
  BeadWorkspaceLimitError,
  createBeadWorkspace,
  listBeadWorkspaceOverview,
} from "@/lib/bead/workspacesServer";
import type { CreateBeadWorkspaceInput } from "@/lib/bead/workspaces";

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

    const overview = await listBeadWorkspaceOverview({
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    if (error instanceof BeadWorkspaceLimitError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
          data: error.data,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load workspaces.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const input = (await request.json()) as CreateBeadWorkspaceInput;

    if (
      !input ||
      !input.patternData ||
      !Array.isArray(input.patternData.grid) ||
      !Array.isArray(input.patternData.palette) ||
      !input.brand ||
      !input.sourceType ||
      !(
        input.deleteWorkspaceIds === undefined ||
        Array.isArray(input.deleteWorkspaceIds)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workspace payload.",
        },
        { status: 400 }
      );
    }

    const workspace = await createBeadWorkspace({
      userId: user.id,
      input,
    });

    return NextResponse.json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    if (error instanceof BeadWorkspaceLimitError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
          data: error.data,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create workspace.",
      },
      { status: 500 }
    );
  }
}
