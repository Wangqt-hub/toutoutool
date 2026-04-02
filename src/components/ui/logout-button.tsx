"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCloudBaseAuth } from "@/lib/cloudbase/client";

type CloudBaseSignOutResult = {
  error?: {
    message?: string;
  } | null;
};

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const auth = getCloudBaseAuth() as {
      signOut: (params?: { redirect_uri?: string }) => Promise<CloudBaseSignOutResult>;
    };

    const [cloudbaseResult, logoutResponse] = await Promise.all([
      auth.signOut({ redirect_uri: `${window.location.origin}/` }),
      fetch("/api/auth/logout", {
        method: "POST",
      }),
    ]);

    if (!logoutResponse.ok) {
      throw new Error("Failed to clear app session.");
    }

    if (cloudbaseResult?.error?.message) {
      console.warn("CloudBase signOut reported an error:", cloudbaseResult.error.message);
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void handleLogout();
      }}
      className="gap-1 text-xs"
    >
      <LogOut className="h-3 w-3" />
      退出
    </Button>
  );
}
