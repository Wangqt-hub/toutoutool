import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?from=/tools");
  }

  return <DashboardShell>{children}</DashboardShell>;
}


