import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";
import { callCloudBaseFunction, CloudBaseFunctionError } from "@/lib/server/cloudbase-functions";
import type { UpdateBeadWorkspaceStateInput } from "@/lib/bead/workspaces";
import {
  type BeadWorkspaceRow,
  toWorkspaceRecord,
} from "@/lib/bead/workspacesBackend";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
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
      action: "getWorkspaceById",
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
      data: toWorkspaceRecord(payload.row, payload.currentWorkspaceId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load workspace.",
      },
      {
        status:
          error instanceof CloudBaseFunctionError ? error.status : 500,
      }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const input = (await request.json()) as UpdateBeadWorkspaceStateInput;

    if (
      !input ||
      !Array.isArray(input.completedColorIndexes) ||
      !(input.selectedColorIndex === null || typeof input.selectedColorIndex === "number")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workspace state payload.",
        },
        { status: 400 }
      );
    }

    const data = await callCloudBaseFunction<{
      updatedAt: string;
      lastOpenedAt: string | null;
    } | null>("toutoutool-bead", {
      action: "updateWorkspaceState",
      userId: session.userId,
      workspaceId: context.params.id,
      input,
    });

    if (!data) {
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
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update workspace.",
      },
      {
        status:
          error instanceof CloudBaseFunctionError ? error.status : 500,
      }
    );
  }
}
