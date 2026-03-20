"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setMessage("注册成功，请前往邮箱完成验证后再登录。");
    } catch (err) {
      setError("注册失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-10">
      <Card className="w-full max-w-md bg-white/80">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            欢迎加入头头工具 🐹
          </h1>
          <p className="text-xs text-slate-500">
            只要一个邮箱和一串小小的密码，就可以开启你的工具乐园。
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
              autoComplete="email"
              inputMode="email"
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
              minLength={6}
              autoComplete="new-password"
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
          {message && (
            <p className="text-xs text-green-600 bg-green-50 rounded-2xl px-3 py-2">
              {message}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full mt-2"
            disabled={loading}
          >
            {loading ? "注册中…" : "注册"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          已经有账号了？{" "}
          <Link href="/login" className="text-accent-brown font-medium">
            直接去登录
          </Link>
        </p>
      </Card>
    </main>
  );
}

