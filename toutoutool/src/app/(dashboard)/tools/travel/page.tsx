"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  generateItinerary,
  type BudgetLevel,
  type Itinerary,
  type PreferenceKey,
  type TravelFormInput
} from "@/lib/utils/travelRules";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TravelPlanRow = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget: BudgetLevel;
  preferences: string[] | null;
  itinerary_json: Itinerary | null;
  created_at: string;
};

const PREFERENCE_OPTIONS: { key: PreferenceKey; label: string }[] = [
  { key: "food", label: "美食" },
  { key: "sightseeing", label: "景点" },
  { key: "shopping", label: "购物" },
  { key: "relax", label: "放松" }
];

export default function TravelPlannerPage() {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState<BudgetLevel>("medium");
  const [preferences, setPreferences] = useState<PreferenceKey[]>([
    "sightseeing",
    "food"
  ]);
  const [notes, setNotes] = useState("");

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [plans, setPlans] = useState<TravelPlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadPlans() {
      const { data, error: fetchError } = await supabase
        .from("travel_plans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!fetchError && data) {
        setPlans(data as TravelPlanRow[]);
      }
    }

    loadPlans().catch(() => {
      // 忽略历史记录加载错误，不影响主流程
    });
  }, []);

  function togglePreference(key: PreferenceKey) {
    setPreferences((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!destination || !startDate || !endDate) {
      setError("目的地和时间是必填的哦。");
      return;
    }

    setLoading(true);
    try {
      const input: TravelFormInput = {
        destination,
        startDate,
        endDate,
        budget,
        preferences,
        notes
      };
      const generated = generateItinerary(input);
      setItinerary(generated);
    } catch {
      setError("生成行程时出错，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!itinerary) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: insertError } = await supabase.from("travel_plans").insert({
        destination,
        start_date: startDate,
        end_date: endDate,
        budget,
        preferences,
        itinerary_json: itinerary,
        notes
      });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      const { data: refreshed } = await supabase
        .from("travel_plans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (refreshed) {
        setPlans(refreshed as TravelPlanRow[]);
      }
    } catch {
      setError("保存行程时出错，请稍后再试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">旅行计划</h1>
        <p className="text-sm text-slate-600">
          告诉头头你想去哪里、什么时候出发、偏好什么路线，就能自动生成一份“不赶场”的行程草案。
        </p>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <Card className="space-y-4">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                目的地
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="例如：东京、成都、京都 + 奈良…"
                className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-brown"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  出发日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  结束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  预算感觉
                </label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value as BudgetLevel)}
                  className="w-full rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
                >
                  <option value="low">能省就省（低预算）</option>
                  <option value="medium">适中就好（中等预算）</option>
                  <option value="high">难得一趟（相对宽裕）</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  行程偏好
                </label>
                <div className="flex flex-wrap gap-1">
                  {PREFERENCE_OPTIONS.map((item) => {
                    const active = preferences.includes(item.key);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => togglePreference(item.key)}
                        className={`rounded-full px-3 py-1 text-[11px] border transition-colors ${
                          active
                            ? "bg-accent-brown text-cream-50 border-accent-brown"
                            : "bg-cream-50/60 text-slate-700 border-cream-100 hover:bg-cream-100"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                备注（选填）
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="比如：不想太早起；不喜欢逛商场；想留一整天在咖啡馆写东西…"
                className="w-full resize-none rounded-2xl border border-cream-100 bg-cream-50/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent-brown"
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
              {loading ? "生成中…" : "生成旅行计划"}
            </Button>
          </form>

          <p className="text-[11px] text-slate-500">
            提示：当前版本使用规则生成行程，已经预留了 AI
            接口，未来可以一键升级成更智能的规划助手。
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  行程预览
                </h2>
                <p className="text-xs text-slate-500">
                  可以先生成一份草案，不满意的地方可以导出后再手动调整。
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSave}
                disabled={!itinerary || saving}
              >
                {saving ? "保存中…" : "保存到账号"}
              </Button>
            </div>

            {!itinerary && (
              <div className="flex h-40 items-center justify-center rounded-3xl border border-dashed border-cream-100 bg-cream-50/60 text-xs text-slate-500 text-center px-4">
                还没有生成行程。先在左侧填写信息并生成一份草案吧。
              </div>
            )}

            {itinerary && (
              <div className="max-h-80 overflow-auto space-y-3 pr-1">
                {itinerary.days.map((day) => (
                  <div
                    key={day.day}
                    className="rounded-3xl border border-cream-100 bg-white/80 px-3 py-2 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">
                        第 {day.day} 天 · {day.dateLabel}
                      </p>
                    </div>
                    <div className="space-y-1.5 mt-1">
                      {day.slots.map((slot) => (
                        <div
                          key={slot.timeOfDay}
                          className="flex gap-2 text-[11px]"
                        >
                          <span className="shrink-0 rounded-full bg-cream-100 px-2 py-0.5 text-slate-700">
                            {slot.timeOfDay === "morning"
                              ? "早上"
                              : slot.timeOfDay === "afternoon"
                              ? "下午"
                              : "晚上"}
                          </span>
                          <div className="space-y-0.5">
                            <p className="font-medium text-slate-800">
                              {slot.title}
                            </p>
                            <p className="text-slate-600">{slot.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                最近保存的计划
              </h2>
            </div>
            {plans.length === 0 && (
              <p className="text-xs text-slate-500">
                还没有保存过旅行计划，生成并保存后会出现在这里。
              </p>
            )}
            {plans.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-cream-100 bg-cream-50/70 px-3 py-2 text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">
                        {plan.destination}
                      </span>
                      <span className="text-slate-500">
                        {plan.start_date} ~ {plan.end_date}
                      </span>
                    </div>
                    <p className="text-slate-500">
                      偏好：
                      {Array.isArray(plan.preferences) &&
                      plan.preferences.length > 0
                        ? plan.preferences.join(" / ")
                        : "未填写"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

