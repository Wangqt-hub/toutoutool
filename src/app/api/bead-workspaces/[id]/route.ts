import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/serverUser";
import {
  getBeadWorkspaceById,
  updateBeadWorkspaceState,
} from "@/lib/bead/workspacesServer";
import type { UpdateBeadWorkspaceStateInput } from "@/lib/bead/workspaces";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
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

    const workspace = await getBeadWorkspaceById({
      userId: user.id,
      workspaceId: context.params.id,
    });

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          error: "Workspace not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load workspace.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const input = (await request.json()) as UpdateBeadWorkspaceStateInput;

    if (
      !input ||
      !Array.isArray(input.completedColorIndexes) ||
      !(
        input.selectedColorIndex === null ||
        typeof input.selectedColorIndex === "number"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workspace state payload.",
        },
        { status: 400 }
      );
    }

    const result = await updateBeadWorkspaceState({
      userId: user.id,
      workspaceId: context.params.id,
      input,
    });

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Workspace not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update workspace.",
      },
      { status: 500 }
    );
  }
}
