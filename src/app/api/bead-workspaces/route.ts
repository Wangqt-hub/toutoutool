import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { callCloudBaseFunction, CloudBaseFunctionError } from "@/lib/server/cloudbase-functions";
import {
  type CreateBeadWorkspaceInput,
  WORKSPACE_LIMIT_ERROR_CODE,
} from "@/lib/bead/workspaces";
import {
  type BeadWorkspaceOverviewPayload,
  type BeadWorkspaceRow,
  toWorkspaceOverview,
  toWorkspaceSummary,
} from "@/lib/bead/workspacesBackend";

type WorkspaceLimitPayload = {
  overview?: BeadWorkspaceOverviewPayload;
  requiredDeletionCount?: number;
  maxWorkspaces?: number;
};

function formatLimitPayload(data: unknown) {
  const payload = (data || {}) as WorkspaceLimitPayload;

  return {
    ...payload,
    overview: payload.overview ? toWorkspaceOverview(payload.overview) : undefined,
  };
}

export async function GET() {
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

    const payload = await callCloudBaseFunction<BeadWorkspaceOverviewPayload>(
      "toutoutool-bead",
      {
        action: "listWorkspaceOverview",
        userId: session.userId,
      }
    );

    return NextResponse.json({
      success: true,
      data: toWorkspaceOverview(payload),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load workspaces.",
      },
      {
        status:
          error instanceof CloudBaseFunctionError ? error.status : 500,
      }
    );
  }
}

export async function POST(request: Request) {
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

    const input = (await request.json()) as CreateBeadWorkspaceInput;

    if (
      !input ||
      !input.patternData ||
      !Array.isArray(input.patternData.grid) ||
      !Array.isArray(input.patternData.palette) ||
      !input.brand ||
      !input.sourceType ||
      !(input.deleteWorkspaceIds === undefined || Array.isArray(input.deleteWorkspaceIds))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workspace payload.",
        },
        { status: 400 }
      );
    }

    const payload = await callCloudBaseFunction<{
      currentWorkspaceId: string | null;
      row: BeadWorkspaceRow;
    }>("toutoutool-bead", {
      action: "createWorkspace",
      userId: session.userId,
      input,
    });

    return NextResponse.json({
      success: true,
      data: toWorkspaceSummary(payload.row, payload.currentWorkspaceId),
    });
  } catch (error) {
    if (
      error instanceof CloudBaseFunctionError &&
      error.code === WORKSPACE_LIMIT_ERROR_CODE
    ) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
          data: formatLimitPayload(error.data),
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
      {
        status:
          error instanceof CloudBaseFunctionError ? error.status : 500,
      }
    );
  }
}
