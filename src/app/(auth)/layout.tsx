import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AuthLayout({
  children
}: {
  children: ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/tools");
  }

  return <>{children}</>;
}

