"use client";

import {
  Suspense,
  useEffect,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Eye, EyeOff } from "lucide-react";
import { CapybaraHero } from "@/components/mascot/CapybaraHero";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCloudBaseAuth } from "@/lib/cloudbase/client";
import {
  formatPhoneForDisplay,
  normalizePhoneNumber,
} from "@/lib/auth/phone";

type AuthIntent = "signin" | "signup";
type SignInMode = "password" | "otp";

type OtpState = {
  verificationId: string;
  phoneNumber: string;
  isExistingUser: boolean;
};

function getSafeRedirect(to: string | null): Route {
  const fallback = "/tools" as Route;

  if (!to || !to.startsWith("/") || to.startsWith("//") || to.includes("://")) {
    return fallback;
  }

  return to as Route;
}

function hasSessionHintCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie.split("; ").some((item) => item === "tt_auth_hint=1");
}

async function createServerSession(options: {
  accessToken: string;
  phoneNumber?: string | null;
}) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken: options.accessToken,
      phone: options.phoneNumber,
    }),
  });

  const payload = (await response.json()) as {
    success: boolean;
    error?: string;
  };

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Failed to create session.");
  }
}

function normalizeAuthError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();

  if (!message) {
    return fallback;
  }

  if (/invalid_username_or_password|invalid password|wrong password/i.test(message)) {
    return "手机号或密码不正确，请再检查一次。";
  }

  if (/user.*not.*found|not registered|not exist/i.test(message)) {
    return "这个手机号还没有注册。";
  }

  if (/already.*exists|already.*registered|duplicate/i.test(message)) {
    return "这个手机号已经注册过了。";
  }

  return message;
}

async function resolveAccessToken(options: {
  auth: ReturnType<typeof getCloudBaseAuth>;
  preferredToken?: string | null;
}) {
  if (options.preferredToken) {
    return options.preferredToken;
  }

  const accessInfo = await options.auth.getAccessToken();

  if (!accessInfo?.accessToken) {
    throw new Error("CloudBase did not return an access token.");
  }

  return accessInfo.accessToken;
}

async function finalizeSuccessfulAuth(options: {
  auth: ReturnType<typeof getCloudBaseAuth>;
  phoneNumber: string;
  preferredToken?: string | null;
}) {
  const accessToken = await resolveAccessToken({
    auth: options.auth,
    preferredToken: options.preferredToken,
  });

  await createServerSession({
    accessToken,
    phoneNumber: options.phoneNumber,
  });
}

function FieldLabel(props: { children: string }) {
  return <label className="text-sm font-medium text-slate-700">{props.children}</label>;
}

function TextField(
  props: InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean;
  }
) {
  const { className, invalid, ...rest } = props;

  return (
    <input
      {...rest}
      className={clsx(
        "w-full rounded-[1.35rem] border bg-cream-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition",
        invalid
          ? "border-red-200 ring-2 ring-red-100"
          : "border-cream-100 focus:border-accent-brown focus:ring-2 focus:ring-accent-brown/15",
        className
      )}
    />
  );
}

function PasswordField(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <FieldLabel>密码</FieldLabel>
      <div className="relative">
        <TextField
          type={visible ? "text" : "password"}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-4 text-slate-400 transition hover:text-accent-brown"
          aria-label={visible ? "隐藏密码" : "显示密码"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function PhoneAuthFormContent(props: { intent: AuthIntent }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signInMode, setSignInMode] = useState<SignInMode>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpState, setOtpState] = useState<OtpState | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);

  const from = getSafeRedirect(searchParams.get("from"));
  const isSignUp = props.intent === "signup";
  const switchPath = isSignUp ? "/login" : "/register";
  const switchHref =
    from === "/tools"
      ? (switchPath as Route)
      : {
          pathname: switchPath,
          query: { from },
        };

  const needsPasswordForOtp =
    !isSignUp && signInMode === "otp" && otpState?.isExistingUser === false;
  const showCodeField = isSignUp || signInMode === "otp";
  const showPrimaryPassword = isSignUp || signInMode === "password" || needsPasswordForOtp;
  const showConfirmPassword = isSignUp || needsPasswordForOtp;

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldown]);

  useEffect(() => {
    if (isSignUp) {
      setSignInMode("otp");
      return;
    }

    setError(null);
    setMessage(null);
    setCode("");
    setOtpState(null);
  }, [isSignUp, signInMode]);

  useEffect(() => {
    let cancelled = false;

    async function restoreServerSession() {
      try {
        if (!hasSessionHintCookie()) {
          return;
        }

        const auth = getCloudBaseAuth();
        const loginState = await auth.getLoginState();

        if (!loginState?.user) {
          return;
        }

        const accessInfo = await auth.getAccessToken();

        if (!accessInfo?.accessToken) {
          return;
        }

        const currentUser = auth.currentUser as
          | { phone_number?: string; phone?: string }
          | null;
        const phoneNumber =
          normalizePhoneNumber((loginState.user as { phone_number?: string }).phone_number || "") ||
          normalizePhoneNumber((loginState.user as { phone?: string }).phone || "") ||
          normalizePhoneNumber(currentUser?.phone_number || "") ||
          normalizePhoneNumber(currentUser?.phone || "") ||
          null;

        await createServerSession({
          accessToken: accessInfo.accessToken,
          phoneNumber,
        });

        if (!cancelled) {
          router.replace(from);
          router.refresh();
        }
      } catch {
        // Keep manual sign-in available when no local CloudBase state exists.
      } finally {
        if (!cancelled) {
          setRestoringSession(false);
        }
      }
    }

    void restoreServerSession();

    return () => {
      cancelled = true;
    };
  }, [from, router]);

  function handlePhoneChange(value: string) {
    setPhone(value);
    if (otpState) {
      setOtpState(null);
      setCode("");
      setMessage(null);
      setError(null);
    }
  }

  function validatePasswordFields() {
    if (password.trim().length < 6) {
      throw new Error("请设置至少 6 位的密码。");
    }

    if (showConfirmPassword && password !== confirmPassword) {
      throw new Error("两次输入的密码不一致，请再确认一次。");
    }
  }

  async function handleSendCode() {
    const normalizedPhone = normalizePhoneNumber(phone);

    if (!normalizedPhone) {
      setError("请输入正确的手机号。");
      return;
    }

    setSending(true);
    setError(null);
    setMessage(null);

    try {
      const auth = getCloudBaseAuth();
      const verification = await auth.getVerification({
        phone_number: normalizedPhone,
        target: "ANY",
      });

      if (!verification?.verification_id) {
        throw new Error("验证码发送成功，但没有拿到校验凭证。");
      }

      const isExistingUser = Boolean(verification.is_user);

      setPhone(formatPhoneForDisplay(normalizedPhone));
      setOtpState({
        verificationId: verification.verification_id,
        phoneNumber: normalizedPhone,
        isExistingUser,
      });
      setCooldown(60);
      setCode("");

      if (isSignUp && isExistingUser) {
        setMessage("该手机号已注册，请直接登录。");
      } else if (!isSignUp && signInMode === "otp" && !isExistingUser) {
        setMessage("验证通过后还需要设置密码。");
      } else {
        setMessage("验证码已发送。");
      }
    } catch (requestError) {
      setOtpState(null);
      setError(normalizeAuthError(requestError, "验证码发送失败，请稍后再试。"));
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const normalizedPhone = normalizePhoneNumber(phone);

    if (!normalizedPhone) {
      setError("请输入正确的手机号。");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const auth = getCloudBaseAuth();

      if (isSignUp) {
        if (!otpState?.verificationId) {
          throw new Error("请先发送验证码。");
        }

        if (otpState.phoneNumber !== normalizedPhone) {
          throw new Error("你修改了手机号，请重新发送验证码。");
        }

        if (otpState.isExistingUser) {
          throw new Error("该手机号已注册，请直接登录。");
        }

        validatePasswordFields();

        const result = await auth.signUp({
          phone_number: normalizedPhone,
          verification_code: code.trim(),
          password,
        });

        const preferredToken = (
          result as { data?: { session?: { access_token?: string } } }
        )?.data?.session?.access_token;

        await finalizeSuccessfulAuth({
          auth,
          phoneNumber: normalizedPhone,
          preferredToken,
        });
      } else if (signInMode === "password") {
        const result = await auth.signInWithPassword({
          phone: normalizedPhone,
          password,
        });

        if (result.error) {
          throw new Error(result.error.message || "登录失败，请稍后再试。");
        }

        await finalizeSuccessfulAuth({
          auth,
          phoneNumber: normalizedPhone,
          preferredToken: result.data?.session?.access_token || null,
        });
      } else {
        if (!otpState?.verificationId) {
          throw new Error("请先发送验证码。");
        }

        if (otpState.phoneNumber !== normalizedPhone) {
          throw new Error("你修改了手机号，请重新发送验证码。");
        }

        if (otpState.isExistingUser) {
          const result = await auth.verifyOtp({
            phone: normalizedPhone,
            token: code.trim(),
            messageId: otpState.verificationId,
          });

          if (result.error) {
            throw new Error(result.error.message || "快捷登录失败，请稍后再试。");
          }

          await finalizeSuccessfulAuth({
            auth,
            phoneNumber: normalizedPhone,
            preferredToken: result.data?.session?.access_token || null,
          });
        } else {
          validatePasswordFields();

          const result = await auth.signUp({
            phone_number: normalizedPhone,
            verification_code: code.trim(),
            password,
          });

          const preferredToken = (
            result as { data?: { session?: { access_token?: string } } }
          )?.data?.session?.access_token;

          await finalizeSuccessfulAuth({
            auth,
            phoneNumber: normalizedPhone,
            preferredToken,
          });
        }
      }

      router.replace(from);
      router.refresh();
    } catch (requestError) {
      setError(normalizeAuthError(requestError, "认证失败，请稍后再试。"));
    } finally {
      setSubmitting(false);
    }
  }

  const panelTitle = isSignUp
    ? "注册"
    : signInMode === "password"
      ? "登录"
      : "手机快捷登录";

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-blush/40 blur-3xl" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-accent-yellow/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-accent-brown/8 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full overflow-hidden border-white/70 bg-white/82 p-0 shadow-[0_20px_70px_rgba(154,121,85,0.14)] backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(244,190,184,0.35),transparent_72%)]" />

          <div className="relative p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-5 pt-2">
                <div className="inline-flex items-center rounded-full border border-white/70 bg-cream-100/95 px-6 py-2.5 text-[15px] font-semibold tracking-[0.24em] text-accent-brown shadow-[0_8px_24px_rgba(154,121,85,0.12)]">
                  头头工具
                </div>
                <h1 className="pt-1 text-[2rem] font-bold tracking-[0.02em] text-slate-900 sm:text-[2.2rem]">{panelTitle}</h1>
              </div>
              <div className="mt-1 rounded-[1.35rem] bg-cream-50/90 p-3 shadow-sm ring-1 ring-white/80">
                <CapybaraHero variant="figure" size="sm" />
              </div>
            </div>

            {!isSignUp ? (
              <div className="mt-5">
                <Button
                  type="button"
                  variant={signInMode === "password" ? "secondary" : "ghost"}
                  className="w-full"
                  onClick={() => {
                    setSignInMode((current) =>
                      current === "password" ? "otp" : "password"
                    );
                    setError(null);
                    setMessage(null);
                  }}
                >
                  {signInMode === "password" ? "手机快捷登录" : "返回密码登录"}
                </Button>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <FieldLabel>手机号</FieldLabel>
                <TextField
                  type="tel"
                  required
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => handlePhoneChange(event.target.value)}
                  placeholder="请输入手机号"
                  autoComplete="tel"
                />
              </div>

              {showCodeField ? (
                <div className="space-y-2">
                  <FieldLabel>短信验证码</FieldLabel>
                  <div className="flex gap-2">
                    <TextField
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="输入 6 位验证码"
                      autoComplete="one-time-code"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSendCode}
                      disabled={restoringSession || sending || cooldown > 0}
                      className="min-w-[112px] shrink-0"
                    >
                      {restoringSession
                        ? "检查中"
                        : sending
                          ? "发送中"
                          : cooldown > 0
                            ? `${cooldown}s`
                            : "发送验证码"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {showPrimaryPassword ? (
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  placeholder={
                    needsPasswordForOtp ? "设置登录密码" : "请输入密码"
                  }
                  autoComplete={
                    isSignUp || needsPasswordForOtp ? "new-password" : "current-password"
                  }
                />
              ) : null}

              {showConfirmPassword ? (
                <div className="space-y-2">
                  <FieldLabel>确认密码</FieldLabel>
                  <TextField
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                  />
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[1.3rem] border border-red-100 bg-red-50/90 px-4 py-3 text-sm leading-6 text-red-600">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-[1.3rem] border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm leading-6 text-emerald-700">
                  {message}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="mt-2 w-full"
                disabled={restoringSession || submitting}
              >
                {restoringSession
                  ? "检查已有登录状态…"
                  : submitting
                    ? isSignUp
                      ? "正在注册…"
                      : signInMode === "password"
                        ? "正在登录…"
                        : otpState?.isExistingUser === false
                          ? "正在创建账号…"
                          : "正在验证…"
                    : isSignUp
                      ? "注册"
                      : signInMode === "password"
                        ? "登录"
                        : otpState?.isExistingUser === false
                          ? "验证并继续"
                          : "快捷登录"}
              </Button>
            </form>

            <div className="mt-6 border-t border-cream-100 pt-5 text-center text-sm text-slate-500">
              <p className="inline-flex items-center justify-center gap-1.5">
                {isSignUp ? "已经有账号了？" : "还没有账号？"}
                <Link href={switchHref} className="font-medium text-accent-brown">
                  {isSignUp ? "去登录" : "去注册"}
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export function PhoneAuthForm(props: { intent: AuthIntent }) {
  return (
    <Suspense fallback={null}>
      <PhoneAuthFormContent intent={props.intent} />
    </Suspense>
  );
}
