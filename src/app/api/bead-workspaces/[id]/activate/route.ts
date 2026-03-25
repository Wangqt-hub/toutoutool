import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/serverUser";
import { activateBeadWorkspace } from "@/lib/bead/workspacesServer";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
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

    const workspace = await activateBeadWorkspace({
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
        error:
          error instanceof Error ? error.message : "Failed to activate workspace.",
      },
      { status: 500 }
    );
  }
}
