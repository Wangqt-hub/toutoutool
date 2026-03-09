"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

function getSafeRedirect(to: string | null): Route {
  const fallback = "/tools" as Route;
  if (!to) return fallback;
  if (!to.startsWith("/")) return fallback;
  if (to.startsWith("//")) return fallback;
  if (to.includes("://")) return fallback;
  return to as Route;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = getSafeRedirect(searchParams.get("from"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push(from);
      router.refresh();
    } catch (err) {
      setError("登录失败，请稍后再试。");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-10">
      <Card className="w-full max-w-md bg-white/80">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            欢迎回来，头头在等你 🐹
          </h1>
          <p className="text-xs text-slate-500">
            使用注册邮箱和密码登录，继续捣鼓你的小工具。
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              邮箱
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              密码
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
              placeholder="至少 6 位字符"
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-2xl px-3 py-2">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full mt-2"
            disabled={loading}
          >
            {loading ? "登录中…" : "登录"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          还没有账号？{" "}
          <Link href="/register" className="text-accent-brown font-medium">
            去注册一个
          </Link>
        </p>
      </Card>
    </main>
  );
}

