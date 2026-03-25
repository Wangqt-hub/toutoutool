"use client";

import type {
  BeadWorkspaceLimitData,
  BeadWorkspaceOverview,
  BeadWorkspaceRecord,
  BeadWorkspaceSummary,
  CreateBeadWorkspaceInput,
  UpdateBeadWorkspaceStateInput,
} from "@/lib/bead/workspaces";
import { WORKSPACE_LIMIT_ERROR_CODE } from "@/lib/bead/workspaces";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

export class WorkspaceApiError<T = unknown> extends Error {
  status: number;
  code?: string;
  data?: T;

  constructor(options: {
    message: string;
    status: number;
    code?: string;
    data?: T;
  }) {
    super(options.message);
    this.name = "WorkspaceApiError";
    this.status = options.status;
    this.code = options.code;
    this.data = options.data;
  }
}

export function isWorkspaceLimitError(
  error: unknown
): error is WorkspaceApiError<BeadWorkspaceLimitData> {
  return (
    error instanceof WorkspaceApiError &&
    error.code === WORKSPACE_LIMIT_ERROR_CODE
  );
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new WorkspaceApiError<T>({
      message: payload.error || "Request failed.",
      status: response.status,
      code: payload.code,
      data: payload.data,
    });
  }

  return payload.data;
}

export async function fetchBeadWorkspaceOverview(): Promise<BeadWorkspaceOverview> {
  const response = await fetch("/api/bead-workspaces", {
    cache: "no-store",
  });

  return readApiResponse<BeadWorkspaceOverview>(response);
}

export async function createBeadWorkspace(
  input: CreateBeadWorkspaceInput
): Promise<BeadWorkspaceSummary> {
  const response = await fetch("/api/bead-workspaces", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readApiResponse<BeadWorkspaceSummary>(response);
}

export async function fetchBeadWorkspace(
  workspaceId: string
): Promise<BeadWorkspaceRecord> {
  const response = await fetch(`/api/bead-workspaces/${workspaceId}`, {
    cache: "no-store",
  });

  return readApiResponse<BeadWorkspaceRecord>(response);
}

export async function activateBeadWorkspace(
  workspaceId: string
): Promise<BeadWorkspaceSummary> {
  const response = await fetch(`/api/bead-workspaces/${workspaceId}/activate`, {
    method: "POST",
  });

  return readApiResponse<BeadWorkspaceSummary>(response);
}

export async function updateBeadWorkspaceState(
  workspaceId: string,
  input: UpdateBeadWorkspaceStateInput,
  options?: {
    keepalive?: boolean;
  }
): Promise<Pick<BeadWorkspaceRecord, "updatedAt" | "lastOpenedAt">> {
  const response = await fetch(`/api/bead-workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    keepalive: options?.keepalive ?? false,
  });

  return readApiResponse<Pick<BeadWorkspaceRecord, "updatedAt" | "lastOpenedAt">>(
    response
  );
}
