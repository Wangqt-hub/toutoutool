export type BudgetLevel = "low" | "medium" | "high";

export type PreferenceKey = "food" | "sightseeing" | "shopping" | "relax";

export type TravelPreferences = PreferenceKey[];

export type TravelFormInput = {
  destination: string;
  startDate: string;
  endDate: string;
  budget: BudgetLevel;
  preferences: TravelPreferences;
  notes?: string;
};

export type ItinerarySlot = {
  timeOfDay: "morning" | "afternoon" | "evening";
  title: string;
  description: string;
};

export type DayPlan = {
  day: number;
  dateLabel: string;
  slots: ItinerarySlot[];
};

export type Itinerary = {
  days: DayPlan[];
};

function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  const diff = end.getTime() - start.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

function formatDateLabel(base: string, offset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month} 月 ${day} 日`;
}

function pickActivities(
  destination: string,
  budget: BudgetLevel,
  preferences: TravelPreferences
): Record<"morning" | "afternoon" | "evening", ItinerarySlot> {
  const has = (key: PreferenceKey) => preferences.includes(key);

  const morning: ItinerarySlot = has("sightseeing")
    ? {
        timeOfDay: "morning",
        title: "轻松城市散步",
        description: `在 ${destination} 附近挑一个有代表性的街区，睡饱再出门，边走边感受当地的空气和小店。`
      }
    : {
        timeOfDay: "morning",
        title: "慢悠悠早餐",
        description: `睡到自然醒，在住处附近找一家评价不错的早餐店，好好吃一顿再开始今天。`
      };

  const afternoon: ItinerarySlot = has("food")
    ? {
        timeOfDay: "afternoon",
        title: "主打吃饱的一下午",
        description: `围绕 ${destination} 附近的美食，把想吃的几家排在一条路线上，中途可以穿插逛街或小景点。`
      }
    : has("shopping")
    ? {
        timeOfDay: "afternoon",
        title: "逛街扫货时间",
        description: `前往当地比较集中的商圈或市集，悠闲地逛逛喜欢的品牌、小众店和手作摊位。`
      }
    : {
        timeOfDay: "afternoon",
        title: "博物馆 / 展览",
        description: `选择一个你感兴趣的博物馆或展览，安静地看展，让大脑换个频道。`
      };

  const evening: ItinerarySlot = has("relax")
    ? {
        timeOfDay: "evening",
        title: "早点回住处放空",
        description:
          "晚上早点回住处，可以洗个舒服的澡、整理白天的照片，写写当天的小记，保证好睡眠。"
      }
    : {
        timeOfDay: "evening",
        title: "夜景 / 夜市",
        description: `如果体力还OK，可以去 ${destination} 的夜景点或夜市走一走，记得不要安排得太满。`
      };

  if (budget === "low") {
    afternoon.description += " 预算偏紧的话，可以多选择免费景点和路边小吃。";
  } else if (budget === "high") {
    evening.description += " 如果预算允许，可以考虑一顿稍微丰盛一点的晚餐或体验型活动。";
  }

  return { morning, afternoon, evening };
}

export function generateItinerary(input: TravelFormInput): Itinerary {
  const { destination, startDate, endDate, budget, preferences } = input;
  const dayCount = getDayCount(startDate, endDate);

  const days: DayPlan[] = [];

  for (let i = 0; i < dayCount; i++) {
    const dateLabel = formatDateLabel(startDate, i);
    const { morning, afternoon, evening } = pickActivities(
      destination,
      budget,
      preferences
    );

    days.push({
      day: i + 1,
      dateLabel,
      slots: [morning, afternoon, evening]
    });
  }

  return { days };
}

export async function generateItineraryWithAI(
  input: TravelFormInput
): Promise<Itinerary> {
  // 预留给未来的 AI 版本实现：
  // - 这里可以接入 OpenAI / 其他大模型，根据用户输入生成更个性化的行程
  // - 目前先简单调用规则版，保证前后端接口保持一致
  return generateItinerary(input);
}

