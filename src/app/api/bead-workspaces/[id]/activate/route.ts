import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { callCloudBaseFunction, CloudBaseFunctionError } from "@/lib/server/cloudbase-functions";
import {
  type BeadWorkspaceRow,
  toWorkspaceSummary,
} from "@/lib/bead/workspacesBackend";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
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

    const payload = await callCloudBaseFunction<{
      currentWorkspaceId: string | null;
      row: BeadWorkspaceRow | null;
    }>("toutoutool-bead", {
      action: "activateWorkspace",
      userId: session.userId,
      workspaceId: context.params.id,
    });

    if (!payload.row) {
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
      data: toWorkspaceSummary(payload.row, payload.currentWorkspaceId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to activate workspace.",
      },
      {
        status:
          error instanceof CloudBaseFunctionError ? error.status : 500,
      }
    );
  }
}
