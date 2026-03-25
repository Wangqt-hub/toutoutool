"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceLimitDialog } from "@/components/bead-tool/WorkspaceLimitDialog";
import { WorkspaceReplaceDialog } from "@/components/bead-tool/WorkspaceReplaceDialog";
import { buildWorkspaceThumbnailDataUrl } from "@/lib/bead/workspaceThumbnails";
import {
  createBeadWorkspace,
  fetchBeadWorkspaceOverview,
  isWorkspaceLimitError,
} from "@/lib/bead/workspaceClient";
import type {
  BeadWorkspaceLimitData,
  BeadWorkspaceOverview,
  BeadWorkspaceSummary,
  CreateBeadWorkspaceInput,
} from "@/lib/bead/workspaces";
import {
  MAX_BEAD_WORKSPACES,
  getWorkspaceTotalCount,
  listWorkspaceSummaries,
} from "@/lib/bead/workspaces";

interface UseBeadWorkspaceLaunchOptions {
  onError?: (message: string) => void;
}

type DialogMode = "replace" | "limit" | null;

function buildLimitData(overview: BeadWorkspaceOverview): BeadWorkspaceLimitData {
  const totalCount = getWorkspaceTotalCount(overview);

  return {
    overview,
    requiredDeletionCount: Math.max(1, totalCount - MAX_BEAD_WORKSPACES + 1),
    maxWorkspaces: MAX_BEAD_WORKSPACES,
  };
}

export function useBeadWorkspaceLaunch(options?: UseBeadWorkspaceLaunchOptions) {
  const router = useRouter();
  const [pendingWorkspace, setPendingWorkspace] =
    useState<CreateBeadWorkspaceInput | null>(null);
  const [currentWorkspace, setCurrentWorkspace] =
    useState<BeadWorkspaceSummary | null>(null);
  const [limitData, setLimitData] = useState<BeadWorkspaceLimitData | null>(null);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [loading, setLoading] = useState(false);

  const resetDialogs = useCallback(() => {
    setDialogMode(null);
    setPendingWorkspace(null);
    setCurrentWorkspace(null);
    setLimitData(null);
    setSelectedWorkspaceIds([]);
  }, []);

  const goToWorkspace = useCallback(
    (workspaceId: string) => {
      router.push(`/tools/bead/bead-mode?workspace=${workspaceId}`);
    },
    [router]
  );

  const openLimitDialog = useCallback(
    (input: CreateBeadWorkspaceInput, nextLimitData: BeadWorkspaceLimitData) => {
      setPendingWorkspace(input);
      setCurrentWorkspace(null);
      setLimitData(nextLimitData);
      setSelectedWorkspaceIds([]);
      setDialogMode("limit");
    },
    []
  );

  const openReplaceDialog = useCallback(
    (
      input: CreateBeadWorkspaceInput,
      nextCurrentWorkspace: BeadWorkspaceSummary,
      deleteWorkspaceIds?: string[]
    ) => {
      setPendingWorkspace(input);
      setCurrentWorkspace(nextCurrentWorkspace);
      setLimitData(null);
      setSelectedWorkspaceIds(deleteWorkspaceIds ?? []);
      setDialogMode("replace");
    },
    []
  );

  const createAndGo = useCallback(
    async (input: CreateBeadWorkspaceInput, deleteWorkspaceIds?: string[]) => {
      setLoading(true);

      try {
        const thumbnailDataUrl =
          input.thumbnailDataUrl ||
          buildWorkspaceThumbnailDataUrl(
            input.patternData.grid,
            input.patternData.palette
          );
        const workspace = await createBeadWorkspace({
          ...input,
          thumbnailDataUrl,
          deleteWorkspaceIds,
        });

        resetDialogs();
        goToWorkspace(workspace.id);
      } catch (error) {
        if (isWorkspaceLimitError(error) && error.data) {
          openLimitDialog(input, error.data);
          return;
        }

        options?.onError?.(
          error instanceof Error ? error.message : "进入拼豆工作台失败。"
        );
      } finally {
        setLoading(false);
      }
    },
    [goToWorkspace, openLimitDialog, options, resetDialogs]
  );

  const continueAfterLimitSelection = useCallback(() => {
    if (
      !pendingWorkspace ||
      !limitData ||
      selectedWorkspaceIds.length !== limitData.requiredDeletionCount
    ) {
      return;
    }

    const nextCurrentWorkspace =
      limitData.overview.current &&
      !selectedWorkspaceIds.includes(limitData.overview.current.id)
        ? limitData.overview.current
        : null;

    if (nextCurrentWorkspace) {
      openReplaceDialog(pendingWorkspace, nextCurrentWorkspace, selectedWorkspaceIds);
      return;
    }

    void createAndGo(pendingWorkspace, selectedWorkspaceIds);
  }, [
    createAndGo,
    limitData,
    openReplaceDialog,
    pendingWorkspace,
    selectedWorkspaceIds,
  ]);

  const launchWorkspace = useCallback(
    async (input: CreateBeadWorkspaceInput) => {
      setLoading(true);

      try {
        const overview = await fetchBeadWorkspaceOverview();
        const totalCount = getWorkspaceTotalCount(overview);

        if (totalCount >= MAX_BEAD_WORKSPACES) {
          openLimitDialog(input, buildLimitData(overview));
          return;
        }

        if (overview.current) {
          openReplaceDialog(input, overview.current);
          return;
        }

        await createAndGo(input);
      } catch (error) {
        options?.onError?.(
          error instanceof Error ? error.message : "进入拼豆工作台失败。"
        );
      } finally {
        setLoading(false);
      }
    },
    [createAndGo, openLimitDialog, openReplaceDialog, options]
  );

  const workspaceDialog = useMemo(
    () => (
      <>
        <WorkspaceReplaceDialog
          open={dialogMode === "replace"}
          currentWorkspace={currentWorkspace}
          incomingName={pendingWorkspace?.name ?? null}
          loading={loading}
          onClose={() => {
            if (loading) {
              return;
            }

            resetDialogs();
          }}
          onContinueCurrent={() => {
            if (!currentWorkspace || loading) {
              return;
            }

            resetDialogs();
            goToWorkspace(currentWorkspace.id);
          }}
          onOverwrite={() => {
            if (!pendingWorkspace || loading) {
              return;
            }

            void createAndGo(pendingWorkspace, selectedWorkspaceIds);
          }}
        />

        <WorkspaceLimitDialog
          open={dialogMode === "limit" && Boolean(limitData)}
          workspaces={limitData ? listWorkspaceSummaries(limitData.overview) : []}
          incomingName={pendingWorkspace?.name ?? null}
          requiredDeletionCount={limitData?.requiredDeletionCount ?? 1}
          selectedWorkspaceIds={selectedWorkspaceIds}
          loading={loading}
          onToggleWorkspace={(workspaceId) => {
            if (!limitData || loading) {
              return;
            }

            setSelectedWorkspaceIds((previous) => {
              if (previous.includes(workspaceId)) {
                return previous.filter((item) => item !== workspaceId);
              }

              if (previous.length >= limitData.requiredDeletionCount) {
                return previous;
              }

              return [...previous, workspaceId];
            });
          }}
          onClose={() => {
            if (loading) {
              return;
            }

            resetDialogs();
          }}
          onConfirm={() => {
            if (loading) {
              return;
            }

            continueAfterLimitSelection();
          }}
        />
      </>
    ),
    [
      continueAfterLimitSelection,
      createAndGo,
      currentWorkspace,
      dialogMode,
      goToWorkspace,
      limitData,
      loading,
      pendingWorkspace,
      resetDialogs,
      selectedWorkspaceIds,
    ]
  );

  return {
    launchWorkspace,
    launching: loading,
    workspaceLaunchDialog: workspaceDialog,
  };
}
