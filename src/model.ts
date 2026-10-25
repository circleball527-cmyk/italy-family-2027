import { z } from "zod";

const safeLink = z.union([
  z.literal(""),
  z.string().max(2000).url().refine((value) => value.startsWith("https://"), "網址必須使用 HTTPS"),
]);

const safeImageLink = z.union([
  safeLink,
  z.string().max(500).regex(/^\/assets\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp)$/i, "本機圖片路徑不正確"),
  z.string().max(2500000).regex(/^data:image\/(?:jpeg|png|webp);base64,/i, "上傳圖片格式不正確"),
]);

export const StopSchema = z.object({
  id: z.string().min(1).max(100),
  zh: z.string().min(1, "請填寫中文名稱").max(200),
  it: z.string().max(200),
  kind: z.enum(["agency", "self"]),
  status: z.enum(["pending", "confirmed"]),
  story: z.string().max(20000),
  source: safeLink,
  image: safeImageLink,
  imageSource: safeLink,
  credit: z.string().max(500),
  licenseName: z.string().max(200),
  license: safeLink,
  mapsUrl: safeLink.default(""),
  openingHours: z.string().max(1000).default(""),
  estimatedCostEur: z.number().min(0).max(1000000).nullable().default(null),
  transportMinutes: z.number().int().min(0).max(1440).nullable().default(null),
  transportMode: z.string().max(100).default(""),
  suggested: z.number().int().min(0).max(1440),
  minutes: z.number().int().min(0).max(1440),
  arrival: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時間格式不正確")]),
  note: z.string().max(20000),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
}).refine((stop) => (stop.lat === null) === (stop.lng === null), {
  message: "經緯度須一起填寫或一起留白",
});

export const DaySchema = z.object({
  date: z.string(),
  title: z.string().max(300),
  logistics: z.object({
    wakeUp: z.string().max(5),
    breakfast: z.string().max(5),
    meeting: z.string().max(5),
    meetingPlace: z.string().max(500),
    luggage: z.enum(["pending", "yes", "no"]),
    reminder: z.string().max(5000),
  }),
  flights: z.array(z.object({
    id: z.string().min(1).max(100),
    airline: z.string().max(200),
    flightNumber: z.string().max(50),
    departureAirport: z.string().max(300),
    arrivalAirport: z.string().max(300),
    departureAt: z.string().max(30),
    arrivalAt: z.string().max(30),
    departureTimezone: z.string().max(100),
    arrivalTimezone: z.string().max(100),
    duration: z.string().max(100),
    terminal: z.string().max(300),
    note: z.string().max(5000),
  })).max(10),
  agencyOriginal: z.string().max(20000),
  agencySource: z.string().max(2000),
  note: z.string().max(20000),
  stops: z.array(StopSchema).max(100),
});

export const TripSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(200),
  agencyMeta: z.object({
    tourName: z.string().max(500),
    tourCode: z.string().max(100),
    updatedAt: z.string().max(100),
    depositTwd: z.number().int().min(0),
    adultPriceTwd: z.number().int().min(0),
    singleRoomTwd: z.number().int().min(0),
    outbound: z.string().max(500),
    inbound: z.string().max(500),
    source: z.string().max(2000),
  }),
  packing: z.array(z.object({
    id: z.string().min(1).max(100),
    category: z.string().min(1).max(100),
    name: z.string().min(1).max(300),
    checked: z.boolean(),
    quantity: z.number().int().min(1).max(999),
    bag: z.enum(["carry", "checked", "either"]),
    note: z.string().max(1000),
  })).max(500),
  purchasePeople: z.array(z.string().min(1).max(100)).max(100).default(["爸爸", "媽媽", "妹妹", "姊姊", "全家"]),
  purchasePurposes: z.array(z.string().min(1).max(100)).max(100).default(["給同事", "給朋友", "自己吃"]),
  purchases: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(300),
    person: z.string().min(1).max(100),
    purpose: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(999),
    checked: z.boolean(),
    image: safeImageLink.default(""),
    estimatedCost: z.number().min(0).max(10000000).default(0),
    currency: z.enum(["EUR", "TWD"]).default("EUR"),
    payment: z.enum(["card", "cash"]).default("cash"),
    note: z.string().max(1000),
  })).max(1000).default([]),
  expenses: z.array(z.object({
    id: z.string().min(1).max(100),
    date: z.string(),
    category: z.enum(["餐食", "交通", "門票", "購物", "住宿", "其他"]),
    item: z.string().min(1).max(300),
    amount: z.number().min(0).max(10000000),
    currency: z.enum(["EUR", "TWD"]),
    payment: z.enum(["card", "cash"]).default("cash"),
    note: z.string().max(1000),
  })).max(2000),
  eurToTwd: z.number().min(0).max(1000),
  cashFunds: z.object({
    EUR: z.number().min(0).max(10000000),
    TWD: z.number().min(0).max(10000000),
  }).default({ EUR: 0, TWD: 0 }),
  transportPlanVersion: z.number().int().min(0).max(100).default(0),
  days: z.array(DaySchema).length(10),
}).superRefine((trip, ctx) => {
  const ids = new Set<string>();
  trip.days.forEach((day, index) => {
    if (day.date !== dateOf(index)) ctx.addIssue({ code: "custom", message: "日期須依序為 2027/1/2～1/11" });
    day.stops.forEach((stop) => {
      if (ids.has(stop.id)) ctx.addIssue({ code: "custom", message: "景點 ID 不可重複" });
      ids.add(stop.id);
    });
  });
});

export type Stop = z.infer<typeof StopSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Trip = z.infer<typeof TripSchema>;

export function withTransportDefaults(trip: Trip): Trip {
  const migratePreset = trip.transportPlanVersion < 2;
  const defaultMode = (dayIndex: number) => dayIndex === 3 || dayIndex === 4 || dayIndex === 7 ? "步行" : "遊覽車";
  const distanceKm = (from: Stop, to: Stop) => {
    if (from.lat === null || from.lng === null || to.lat === null || to.lng === null) return null;
    const radians = (value: number) => value * Math.PI / 180;
    const latDelta = radians(to.lat - from.lat);
    const lngDelta = radians(to.lng - from.lng);
    const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(lngDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const estimateMinutes = (km: number, mode: string) => {
    const normalized = mode.toLowerCase();
    const { speed, buffer } = normalized.includes("步行") && !normalized.includes("計程車") ? { speed: 4, buffer: 2 }
      : normalized.includes("計程車") ? { speed: 20, buffer: 8 }
      : normalized.includes("火車") ? { speed: 80, buffer: 15 }
      : normalized.includes("船") ? { speed: 15, buffer: 10 }
      : normalized.includes("大眾") ? { speed: 18, buffer: 10 }
      : { speed: 35, buffer: 10 };
    const raw = km * 1.25 / speed * 60 + buffer;
    return Math.max(5, Math.round(raw / 5) * 5);
  };
  const timetableGap = (from: Stop, to: Stop) => {
    if (!from.arrival || !to.arrival) return null;
    const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    let gap = toMinutes(to.arrival) - (toMinutes(from.arrival) + from.minutes);
    if (gap < 0) gap += 1440;
    return gap >= 0 && gap <= 180 ? Math.max(5, Math.round(gap / 5) * 5) : null;
  };
  return {
    ...trip,
    transportPlanVersion: 2,
    days: trip.days.map((day, dayIndex) => ({
      ...day,
      stops: day.stops.map((stop, stopIndex, stops) => {
        let transportMode = stop.transportMode || defaultMode(dayIndex);
        let savedMinutes = stop.transportMinutes;
        if (migratePreset && dayIndex === 4 && transportMode === "遊覽車") { transportMode = "步行"; savedMinutes = null; }
        if (migratePreset && dayIndex === 7) { transportMode = "步行"; savedMinutes = null; }
        if (migratePreset && dayIndex === 6) {
          transportMode = stopIndex >= 1 && stopIndex <= 3 ? "遊覽車" : "步行";
          savedMinutes = null;
        }
        if (savedMinutes !== null || stopIndex === 0) return { ...stop, transportMode, transportMinutes: savedMinutes };
        const previous = stops[stopIndex - 1];
        const km = distanceKm(previous, stop);
        return { ...stop, transportMode, transportMinutes: km === null ? timetableGap(previous, stop) : estimateMinutes(km, transportMode) };
      }),
    })),
  };
}

const estimatedCostByStop: Record<string, number | null> = {
  "桃園國際機場｜搭機前往羅馬": 0, "桃園國際機場｜返抵台灣": 0,
  "文藝復興之都～佛羅倫斯市區觀光": 0, "聖母百花大教堂": 0, "佛羅倫斯老橋": 0, "領主廣場": 0,
  "威尼斯本島": 0, "聖馬可廣場": 0, "嘆息橋": 0, "聖馬可廣場與教堂周邊": 0,
  "午餐及休息": 25, "里亞托橋周邊": 0, "咖啡休息與返程準備": 8,
  "米蘭市區觀光": 0, "米蘭大教堂": 15, "艾曼紐二世拱廊": 0, "波隆那": 0,
  "古羅馬深度遊（自費行程）": 140, "聖彼得大教堂": 0, "羅馬競技場": 18,
  "四河噴泉": 0, "萬神殿": 5, "許願池（特雷維噴泉）": 0,
  "蕾莉歐 L'ERBOLARIO 專賣店": 30, "Amorino Gelato - Roma Trevi": 7,
  "Dolce Maniera（早餐／烘焙）": 8, "Panificio Bonci（麵包店）": 10, "梵蒂岡博物館": 25,
  "聖伯多祿大殿": 0, "Caffè Delle Commari": 8, "Forno Feliziani": 10,
  "Todis 超市（Roma · Via Sebastiano Veniero）": 20, "羅馬機場 Louis Vuitton｜代購小皮夾": null,
};

export function withEstimatedCosts(trip: Trip): Trip {
  const infer = (stop: Stop): number | null => {
    if (Object.prototype.hasOwnProperty.call(estimatedCostByStop, stop.zh)) return estimatedCostByStop[stop.zh];
    if (stop.zh.includes("晚餐")) return 35;
    if (stop.zh.includes("午餐")) return 25;
    if (stop.zh.includes("點心") || stop.zh.includes("咖啡")) return 8;
    if (stop.zh.includes("博物館")) return 15;
    return null;
  };
  return { ...trip, days: trip.days.map((day) => ({ ...day, stops: day.stops.map((stop) => stop.estimatedCostEur !== null ? stop : { ...stop, estimatedCostEur: infer(stop) }) })) };
}

export function cashBalance(trip: Trip, currency: "EUR" | "TWD") {
  const spent = trip.expenses
    .filter((entry) => entry.payment === "cash" && entry.currency === currency)
    .reduce((sum, entry) => sum + entry.amount, 0);
  return { spent, balance: trip.cashFunds[currency] - spent };
}

const generatedPosterByStop: Record<string, string> = {
  "桃園國際機場｜搭機前往羅馬": "taoyuan-airport.jpg",
  "桃園國際機場｜返抵台灣": "taoyuan-airport.jpg",
  "文藝復興之都～佛羅倫斯市區觀光": "florence-city.jpg",
  "聖母百花大教堂": "florence-duomo.jpg",
  "佛羅倫斯老橋": "ponte-vecchio.jpg",
  "領主廣場": "piazza-signoria.jpg",
  "威尼斯本島": "venice-main-island.jpg",
  "聖馬可廣場": "venice-san-marco.jpg",
  "嘆息橋": "bridge-of-sighs.jpg",
  "聖馬可廣場與教堂周邊": "venice-san-marco.jpg",
  "午餐及休息": "venice-lunch.jpg",
  "里亞托橋周邊": "venice-rialto.jpg",
  "咖啡休息與返程準備": "venice-coffee.jpg",
  "威尼斯聖露西亞車站｜步行起點": "venice-main-island.jpg",
  "卡納雷吉歐與威尼斯猶太區": "venice-main-island.jpg",
  "卡納雷吉歐運河散步": "venice-main-island.jpg",
  "午餐及休息｜卡納雷吉歐": "venice-lunch.jpg",
  "咖啡休息與步行返程準備": "venice-coffee.jpg",
  "米蘭市區觀光": "milan-city.jpg",
  "米蘭大教堂": "milan-duomo.jpg",
  "艾曼紐二世拱廊": "milan-galleria-family.jpg",
  "波隆那": "bologna.jpg",
  "古羅馬深度遊（自費行程）": "rome-ancient.jpg",
  "羅馬競技場": "rome-ancient.jpg",
  "聖彼得大教堂": "st-peters-basilica.jpg",
  "聖伯多祿大殿": "st-peters-basilica.jpg",
  "四河噴泉": "four-rivers.jpg",
  "萬神殿": "pantheon.jpg",
  "許願池（特雷維噴泉）": "trevi-fountain.jpg",
  "蕾莉歐 L'ERBOLARIO 專賣店": "lerbolario-trevi.jpg",
  "Amorino Gelato - Roma Trevi": "amorino-trevi.jpg",
  "Dolce Maniera（早餐／烘焙）": "dolce-maniera.jpg",
  "Panificio Bonci（麵包店）": "panificio-bonci.jpg",
  "Caffè Delle Commari": "caffe-commari.jpg",
  "Forno Feliziani": "forno-feliziani.jpg",
  "Todis 超市（Roma · Via Sebastiano Veniero）": "todis-vatican.jpg",
  "梵蒂岡博物館": "vatican-museums.jpg",
  "羅馬機場 Louis Vuitton｜代購小皮夾": "rome-fco-louis-vuitton.jpg",
};

export function withDay4WalkingPlan(trip: Trip): Trip {
  const previousDefaults = ["聖馬可廣場與教堂周邊", "午餐及休息", "里亞托橋周邊", "咖啡休息與返程準備"];
  const plannedStops: Stop[] = [
    {
      ...blankStop(), zh: "威尼斯聖露西亞車站｜步行起點", it: "Stazione di Venezia Santa Lucia",
      story: "聖露西亞車站位於威尼斯本島，是由 Mestre 搭火車進入威尼斯時的主要入口；出站即面向大運河。",
      source: "https://www.veneziaunica.it/en/content/arriving-train",
      suggested: 20, minutes: 20, arrival: "10:00", lat: 45.4410, lng: 12.3210,
      mapsUrl: googleMapsPlaceUrl("Stazione di Venezia Santa Lucia"),
      note: "此處僅作為本島步行起點。候選飯店皆在 Mestre／Marghera，飯店到本島仍須使用旅行社接駁、火車、公車或計程車；實際抵達時間待飯店與集合資訊確認。",
    },
    {
      ...blankStop(), zh: "卡納雷吉歐與威尼斯猶太區", it: "Cannaregio · Ghetto Ebraico di Venezia",
      story: "卡納雷吉歐保留較多住宅區與運河生活風景；威尼斯猶太區成立於 1516 年，是歐洲歷史最悠久的猶太區之一。",
      source: "https://www.veneziaunica.it/en/things-to-do-in-venice/itineraries/cannaregio-authenticity-and-traditions",
      suggested: 75, minutes: 75, arrival: "10:30", lat: 45.4453, lng: 12.3262,
      mapsUrl: googleMapsPlaceUrl("Campo del Ghetto Nuovo Venezia"),
      note: "由聖露西亞車站步行前往，沿途有橋梁與石板路；以戶外散步為主，不預設博物館或宗教場所入內。長輩可隨時縮短。",
    },
    {
      ...blankStop(), zh: "午餐及休息｜卡納雷吉歐", it: "Pranzo e pausa a Cannaregio",
      suggested: 75, minutes: 75, arrival: "12:00", lat: 45.4450, lng: 12.3290,
      mapsUrl: googleMapsPlaceUrl("Cannaregio Venezia ristoranti"),
      note: "餐廳尚未選定或預訂；優先找有座位、洗手間、暖氣且不需跨越太多橋梁的餐廳。",
    },
    {
      ...blankStop(), zh: "卡納雷吉歐運河散步", it: "Fondamenta degli Ormesini · Fondamenta della Misericordia",
      story: "Ormesini 與 Misericordia 一帶沿著運河展開，適合放慢速度觀察威尼斯住宅區、橋梁與水岸生活。",
      source: "https://www.veneziaunica.it/en/things-to-do-in-venice/itineraries/cannaregio-authenticity-and-traditions",
      suggested: 45, minutes: 45, arrival: "13:30", lat: 45.4457, lng: 12.3308,
      mapsUrl: googleMapsPlaceUrl("Fondamenta della Misericordia Venezia"),
      note: "全程步行、各站移動時間另計。雨天、低溫或長輩疲累時可直接取消本段，改為室內咖啡休息。",
    },
    {
      ...blankStop(), zh: "里亞托橋周邊", it: "Ponte di Rialto",
      story: "里亞托橋現存石橋建於 16 世紀末，是大運河的重要通道與威尼斯代表性地標。",
      source: "https://www.veneziaunica.it/en/things-to-do-in-venice/monuments-and-theatres/rialto-bridge",
      suggested: 45, minutes: 45, arrival: "14:45", lat: 45.4380, lng: 12.3359,
      mapsUrl: googleMapsPlaceUrl("Ponte di Rialto"),
      note: "由卡納雷吉歐步行前往，路線有多座橋及石板路。長輩體力不足時取消此站，留在卡納雷吉歐休息；橋面有階梯，可只在岸邊觀景。",
    },
    {
      ...blankStop(), zh: "咖啡休息與步行返程準備", it: "Pausa caffè e rientro a piedi",
      suggested: 60, minutes: 60, arrival: "15:45", lat: 45.4405, lng: 12.3298,
      mapsUrl: googleMapsPlaceUrl("Cannaregio Venezia caffè"),
      note: "預留坐下休息及步行返回聖露西亞車站的時間。住宿與集合地點未確認，不能指定車次或保證準時返回；建議天黑前開始返程。",
    },
  ];
  return {
    ...trip,
    days: trip.days.map((day, index) => {
      if (index !== 3 || day.stops.some((stop) => stop.zh === plannedStops[0].zh)) return day;
      const isPreviousDraft = day.stops.length === previousDefaults.length && day.stops.every((stop, stopIndex) => stop.zh === previousDefaults[stopIndex]);
      return isPreviousDraft ? { ...day, note: `${day.note}\n目前採抵達本島後全程步行的預計路線；飯店往返本島交通待確認。`, stops: plannedStops } : day;
    }),
  };
}

const knownOpeningHoursByStop: Record<string, string> = {
  "聖彼得大教堂": "宗教場所開放時間依 2027 年當日公告；出發前再次確認",
  "聖伯多祿大殿": "宗教場所開放時間依 2027 年當日公告；出發前再次確認",
  "羅馬競技場": "依預約票券時段；2027 年開放時間待確認",
  "四河噴泉": "戶外廣場全天可到訪",
  "萬神殿": "依官方公告與宗教活動調整；2027 年出發前確認",
  "許願池（特雷維噴泉）": "戶外區域全天可到訪；管制與維護依現場公告",
  "蕾莉歐 L'ERBOLARIO 專賣店": "Google Maps 商家頁顯示時間可能異動；出發前再次確認",
  "Amorino Gelato - Roma Trevi": "週五 11:00–23:30（官方網站 2026 資料；2027 出發前確認）",
  "Dolce Maniera（早餐／烘焙）": "24 小時營業（商家網站 2026 資料；2027 出發前確認）",
  "Panificio Bonci（麵包店）": "週六 07:30–20:30（官方網站 2026 資料；2027 出發前確認）",
  "梵蒂岡博物館": "依預約票券時段；2027 年開放時間待確認",
  "Caffè Delle Commari": "週六 06:30–22:30（2026 查詢資料；2027 出發前確認）",
  "Forno Feliziani": "週六 07:30–16:30（2026 查詢資料；2027 出發前確認）",
  "Todis 超市（Roma · Via Sebastiano Veniero）": "週六 08:00–21:00（2026 查詢資料；2027 出發前確認）",
  "羅馬機場 Louis Vuitton｜代購小皮夾": "每日 06:00–22:00（Louis Vuitton 官方網站 2026 資料；2027 出發前確認）",
};

export function withDay9AirportShopping(trip: Trip): Trip {
  const shoppingStop: Stop = {
    ...blankStop(),
    zh: "羅馬機場 Louis Vuitton｜代購小皮夾",
    it: "Louis Vuitton Roma Fiumicino · portafoglio",
    story: "Louis Vuitton 官方門市資料顯示，羅馬菲烏米奇諾機場店位於第 3 航廈前廊，販售包款與配件等商品。此站為代購小皮夾的購物待辦，並非旅行社安排。",
    source: "https://it.louisvuitton.com/ita-it/negozio/italy/louis-vuitton-roma-fiumicino",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Rome_Fiumicino_Leonardo_da_Vinci_International_Airport%2C_Aeroporto_internazionale_di_Roma-Fiumicino_%22Leonardo_da_Vinci%22.jpg?width=960",
    imageSource: "https://commons.wikimedia.org/wiki/File:Rome_Fiumicino_Leonardo_da_Vinci_International_Airport,_Aeroporto_internazionale_di_Roma-Fiumicino_%22Leonardo_da_Vinci%22.jpg",
    credit: "Apaleutos25；原圖縮放顯示",
    licenseName: "CC BY-SA 4.0",
    license: "https://creativecommons.org/licenses/by-sa/4.0/",
    mapsUrl: googleMapsPlaceUrl("Louis Vuitton Roma Fiumicino"),
    openingHours: "每日 06:00–22:00（Louis Vuitton 官方網站 2026 資料；2027 出發前確認）",
    suggested: 30,
    minutes: 30,
    arrival: "",
    note: "待確認購買款式、顏色與預算。先完成退稅、報到與安檢等團體流程；僅在航廈動線、登機時間及店舖開放允許時前往。商品庫存與免稅資格依門市及當日規定，不保證買得到。",
    lat: 41.8003,
    lng: 12.2462,
  };
  return {
    ...trip,
    days: trip.days.map((day, index) => index !== 8 || day.stops.some((stop) => stop.zh === shoppingStop.zh)
      ? day
      : { ...day, stops: [...day.stops, shoppingStop] }),
  };
}

export function withKnownOpeningHours(trip: Trip): Trip {
  return { ...trip, days: trip.days.map((day) => ({
    ...day,
    stops: day.stops.map((stop) => stop.openingHours || !knownOpeningHoursByStop[stop.zh] ? stop : { ...stop, openingHours: knownOpeningHoursByStop[stop.zh] }),
  })) };
}

export function withGeneratedPosters(trip: Trip): Trip {
  return {
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => {
        const poster = generatedPosterByStop[stop.zh];
        const forceAirportPoster = stop.zh.startsWith("桃園國際機場｜") && !stop.image.startsWith("data:image/");
        const isPreviousGeneratedGalleria =
          stop.zh === "艾曼紐二世拱廊" && stop.image === "/assets/travel-posters/milan-galleria.jpg";
        if (!poster || (!forceAirportPoster && stop.image && !stop.image.includes("commons.wikimedia.org") && !isPreviousGeneratedGalleria)) return stop;
        return {
          ...stop,
          image: `/assets/travel-posters/${poster}`,
          imageSource: "",
          credit: "OpenAI ImageGen；依地標名稱與旅行手帳提示詞生成",
          licenseName: "AI 生成圖",
          license: "",
        };
      }),
    })),
  };
}

const knownLocationByStop: Record<string, { lat: number; lng: number }> = {
  "桃園國際機場｜搭機前往羅馬": { lat: 25.0797, lng: 121.2342 },
  "桃園國際機場｜返抵台灣": { lat: 25.0797, lng: 121.2342 },
  "文藝復興之都～佛羅倫斯市區觀光": { lat: 43.7696, lng: 11.2558 },
  "聖母百花大教堂": { lat: 43.7731, lng: 11.2560 },
  "佛羅倫斯老橋": { lat: 43.7680, lng: 11.2531 },
  "領主廣場": { lat: 43.7697, lng: 11.2556 },
  "威尼斯本島": { lat: 45.4408, lng: 12.3155 },
  "聖馬可廣場": { lat: 45.43426, lng: 12.33851 },
  "嘆息橋": { lat: 45.43406, lng: 12.34086 },
  "聖馬可廣場與教堂周邊": { lat: 45.4342, lng: 12.3387 },
  "里亞托橋周邊": { lat: 45.4380, lng: 12.3359 },
  "米蘭市區觀光": { lat: 45.4642, lng: 9.1900 },
  "米蘭大教堂": { lat: 45.4642, lng: 9.1916 },
  "艾曼紐二世拱廊": { lat: 45.4658, lng: 9.1900 },
  "波隆那": { lat: 44.4949, lng: 11.3426 },
  "古羅馬深度遊（自費行程）": { lat: 41.8902, lng: 12.4922 },
  "聖彼得大教堂": { lat: 41.9021667, lng: 12.4539367 },
  "羅馬競技場": { lat: 41.8902, lng: 12.4922 },
  "四河噴泉": { lat: 41.89896, lng: 12.47306 },
  "萬神殿": { lat: 41.89861, lng: 12.47687 },
  "許願池（特雷維噴泉）": { lat: 41.90093, lng: 12.48331 },
  "梵蒂岡博物館": { lat: 41.9065, lng: 12.4536 },
};

const googleMapsPlaceNameByStop: Record<string, string> = {
  "桃園國際機場｜搭機前往羅馬": "臺灣桃園國際機場",
  "桃園國際機場｜返抵台灣": "臺灣桃園國際機場",
  "文藝復興之都～佛羅倫斯市區觀光": "佛羅倫斯",
  "聖母百花大教堂": "Cattedrale di Santa Maria del Fiore",
  "佛羅倫斯老橋": "Ponte Vecchio",
  "領主廣場": "Piazza della Signoria",
  "威尼斯本島": "Venezia",
  "聖馬可廣場": "Piazza San Marco",
  "嘆息橋": "Ponte dei Sospiri",
  "聖馬可廣場與教堂周邊": "Piazza San Marco",
  "里亞托橋周邊": "Ponte di Rialto",
  "米蘭市區觀光": "Milano",
  "米蘭大教堂": "Duomo di Milano",
  "艾曼紐二世拱廊": "Galleria Vittorio Emanuele II",
  "波隆那": "Bologna",
  "古羅馬深度遊（自費行程）": "Colosseo",
  "聖彼得大教堂": "Basilica di San Pietro",
  "羅馬競技場": "Colosseo",
  "四河噴泉": "Fontana dei Quattro Fiumi",
  "萬神殿": "Pantheon",
  "許願池（特雷維噴泉）": "Fontana di Trevi",
  "梵蒂岡博物館": "Musei Vaticani",
};

export const googleMapsPlaceUrl = (name: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;

const legacyGoogleMapsPlaceUrl = (name: string, lat: number, lng: number) =>
  `https://www.google.com/maps/place/${encodeURIComponent(name)}/@${lat},${lng},17z`;

const isGeneratedCoordinateMapsUrl = (url: string) =>
  /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(url);

export function withDay3VeniceStops(trip: Trip): Trip {
  const additions: Stop[] = [
    {
      ...blankStop(), id: "day3-piazza-san-marco", zh: "聖馬可廣場", it: "Piazza San Marco",
      kind: "agency", status: "pending", suggested: 45,
      story: "聖馬可廣場是威尼斯最重要的公共廣場，周邊可見聖馬可教堂、鐘樓與總督宮；旅行社原稿將此處列入 Day 3 行程。",
      note: "旅行社安排，抵達與停留時間待領隊確認；冬季注意低溫、海風與高水位公告。",
    },
    {
      ...blankStop(), id: "day3-ponte-dei-sospiri", zh: "嘆息橋", it: "Ponte dei Sospiri",
      kind: "agency", status: "pending", suggested: 30,
      story: "嘆息橋建於 17 世紀初，連接總督宮審訊空間與新監獄，是威尼斯聖馬可區的重要地標。",
      note: "旅行社安排，實際觀景位置與步行動線待領隊確認；橋區人潮多，請配合長輩步調。",
    },
  ];
  return {
    ...trip,
    days: trip.days.map((day, index) => index !== 2 ? day : {
      ...day,
      stops: [...day.stops, ...additions.filter((addition) => !day.stops.some((stop) => stop.zh === addition.zh))],
    }),
  };
}

export function withRomeDayPlans(trip: Trip): Trip {
  const planned = (id: string, zh: string, it: string, arrival: string, minutes: number, lat: number, lng: number, mapsUrl: string, story: string, note: string): Stop => ({
    ...blankStop(), id, zh, it, kind: "self", status: "pending", arrival, suggested: minutes, minutes, lat, lng, mapsUrl, story, note,
  });
  const day7Additions: Stop[] = [
    planned("day7-st-peters", "聖彼得大教堂", "Basilica di San Pietro", "09:00", 90, 41.9021667, 12.4539367, googleMapsPlaceUrl("Basilica di San Pietro"), "聖彼得大教堂位於梵蒂岡，是天主教重要宗教建築；入內、安檢與宗教活動安排須依當日公告。", "自行規劃草案；建議預留安檢與休息時間，服裝須符合宗教場所規定。"),
    planned("day7-colosseum", "羅馬競技場", "Colosseo", "11:30", 90, 41.8902, 12.4922, googleMapsPlaceUrl("Colosseo"), "羅馬競技場是古羅馬大型圓形競技場，也是羅馬代表性歷史地標。", "與上一站交通時間另計；是否入內、門票與預約時段待確認。"),
    planned("day7-four-rivers", "四河噴泉", "Fontana dei Quattro Fiumi", "14:30", 30, 41.89896, 12.47306, googleMapsPlaceUrl("Fontana dei Quattro Fiumi"), "四河噴泉位於納沃納廣場中央，由貝尼尼設計，以四條大河的寓意雕塑聞名。", "戶外停留，可依長輩體力縮短；與競技場間交通時間另計。"),
    planned("day7-pantheon", "萬神殿", "Pantheon", "15:15", 45, 41.89861, 12.47687, googleMapsPlaceUrl("Pantheon Roma"), "萬神殿以保存完整的古羅馬圓頂建築聞名，現場入內規定與票務須依官方公告。", "從納沃納廣場步行前往；石板路雨天較滑，安排慢行。"),
    planned("day7-trevi", "許願池（特雷維噴泉）", "Fontana di Trevi", "16:15", 35, 41.90093, 12.48331, googleMapsPlaceUrl("Fontana di Trevi"), "特雷維噴泉是羅馬最著名的巴洛克噴泉之一，中文常稱許願池。", "熱門時段人潮密集，注意隨身物品；停留後安排附近購物與冰淇淋休息。"),
    planned("day7-lerbolario", "蕾莉歐 L'ERBOLARIO 專賣店", "L'ERBOLARIO Roma Trevi", "17:00", 30, 41.9016719, 12.4845182, "https://maps.app.goo.gl/HU9UoJkpDrdaEoacA", "義大利植物保養品牌 L'ERBOLARIO 的羅馬門市。", "位於許願池（特雷維噴泉）附近，步行約 3 分鐘；營業時間與實際步行路線請於當日再次確認。"),
    planned("day7-amorino", "Amorino Gelato - Roma Trevi", "Amorino Gelato · Roma Trevi", "17:40", 40, 41.9014244, 12.4848462, "https://maps.app.goo.gl/z4JRdRzhL1bXzUSb9", "位於羅馬市中心的冰淇淋店，可作為步行行程中的休息站。", "位於許願池（特雷維噴泉）附近；實際營業時間、排隊與座位狀況請當日確認。"),
  ];
  const day8Defaults: Stop[] = [
    planned("day8-dolce-maniera", "Dolce Maniera（早餐／烘焙）", "Dolce Maniera", "08:00", 30, 41.9090832, 12.4559935, "https://maps.app.goo.gl/Hnsrx4fGqoEUUPS96", "梵蒂岡周邊的烘焙店，可安排簡單早餐或外帶。", "前往梵蒂岡博物館前的早餐備案；營業時間與品項請當日確認。"),
    planned("day8-panificio-bonci", "Panificio Bonci（麵包店）", "Panificio Bonci", "08:45", 30, 41.9115619, 12.4536607, "https://maps.app.goo.gl/gvdKL98EwF9AvPwbA", "梵蒂岡周邊的麵包店，可補充飲水與午間簡餐。", "與下一站交通時間另計；若早餐已足夠，可改為外帶或略過。"),
    planned("day8-st-peters", "聖伯多祿大殿", "Basilica di San Pietro", "13:10", 90, 41.9021667, 12.4539367, "https://maps.app.goo.gl/r1x3tC3CkQZP64dM7", "聖伯多祿大殿是梵蒂岡的重要宗教建築，入內通常須經安檢。", "由梵蒂岡博物館前往的交通與步行時間另計；宗教活動、安檢與服裝規定依現場公告。"),
    planned("day8-caffe-commari", "Caffè Delle Commari", "Caffè Delle Commari", "15:15", 45, 41.908024, 12.4540957, "https://maps.app.goo.gl/apqco1pRipWTU9W59", "梵蒂岡博物館周邊的咖啡店，可安排長輩坐下休息。", "作為下午休息站；營業時間與座位情況請當日確認。"),
    planned("day8-forno-feliziani", "Forno Feliziani", "Forno Feliziani", "16:15", 30, 41.9081391, 12.4533698, "https://maps.app.goo.gl/UHJFt2Gkj92GuBRE9", "梵蒂岡周邊的烘焙與簡餐店，可選擇外帶。", "與咖啡休息擇一或視體力順遊；實際營業時間請當日確認。"),
    planned("day8-todis", "Todis 超市（Roma · Via Sebastiano Veniero）", "Todis Supermercato", "17:00", 30, 41.9073625, 12.4538222, "https://maps.app.goo.gl/ZWgsgW6QPupT5b9J9", "梵蒂岡博物館附近的超市，可補充飲水、零食與日用品。", "本日最後補給站；購物重量需考量返程步行與長輩體力。"),
  ];
  return {
    ...trip,
    days: trip.days.map((day, index) => {
      if (index === 6) {
        const missing = day7Additions.filter((addition) => !day.stops.some((stop) => stop.zh === addition.zh));
        return missing.length ? { ...day, stops: [...day.stops, ...missing] } : day;
      }
      if (index !== 7) return day;
      const requiredNames = ["Dolce Maniera（早餐／烘焙）", "Panificio Bonci（麵包店）", "梵蒂岡博物館", "聖伯多祿大殿", "Caffè Delle Commari", "Forno Feliziani", "Todis 超市（Roma · Via Sebastiano Veniero）"];
      const missing = day8Defaults.some((addition) => !day.stops.some((stop) => stop.zh === addition.zh));
      if (!missing) return day;
      const museum = day.stops.find((stop) => stop.zh === "梵蒂岡博物館");
      const museumScheduled = museum ? { ...museum, arrival: museum.arrival || "09:30", suggested: museum.suggested || 180, minutes: museum.minutes || 180 } : null;
      const byName = new Map(day8Defaults.map((stop) => [stop.zh, stop]));
      if (museumScheduled) byName.set("梵蒂岡博物館", museumScheduled);
      const ordered = requiredNames.map((name) => byName.get(name)).filter((stop): stop is Stop => Boolean(stop));
      const extras = day.stops.filter((stop) => !requiredNames.includes(stop.zh));
      return { ...day, stops: [...ordered, ...extras] };
    }),
  };
}

export function withVaticanMuseum(trip: Trip): Trip {
  const defaults: Stop = {
    ...blankStop(),
    id: "day8-vatican-museums",
    zh: "梵蒂岡博物館",
    it: "Musei Vaticani",
    kind: "self",
    status: "pending",
    story: "梵蒂岡博物館收藏跨越古典時代至近代的重要藝術與文物，館區包含多座展館；實際開放、入場與參觀動線須依官方公告及預約時段確認。",
    source: "https://www.museivaticani.va/",
    suggested: 180,
    minutes: 180,
    note: "自行規劃草案，尚未確認或購票。冬季仍可能排隊，需依長輩體力安排休息，並核對 2027 年開放日與入場規定。",
    lat: 41.9065,
    lng: 12.4536,
    mapsUrl: googleMapsPlaceUrl("Musei Vaticani"),
    image: "/assets/travel-posters/vatican-museums.jpg",
    imageSource: "",
    credit: "OpenAI ImageGen；依梵蒂岡博物館與旅行手帳提示詞生成",
    licenseName: "AI 生成圖",
    license: "",
  };
  return {
    ...trip,
    days: trip.days.map((day, index) => {
      if (index !== 7) return day;
      const exists = day.stops.some((stop) => stop.zh === "梵蒂岡博物館");
      return {
        ...day,
        stops: exists
          ? day.stops.map((stop) => stop.zh === "梵蒂岡博物館" ? {
              ...stop,
              it: stop.it || defaults.it,
              source: stop.source || defaults.source,
              lat: defaults.lat,
              lng: defaults.lng,
              mapsUrl: defaults.mapsUrl,
              image: defaults.image,
              imageSource: defaults.imageSource,
              credit: defaults.credit,
              licenseName: defaults.licenseName,
              license: defaults.license,
            } : stop)
          : [...day.stops, defaults],
      };
    }),
  };
}

export function withKnownLocations(trip: Trip): Trip {
  return {
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => {
        const location = knownLocationByStop[stop.zh];
        if (!location) return stop;
        const lat = stop.lat ?? location.lat;
        const lng = stop.lng ?? location.lng;
        const placeName = googleMapsPlaceNameByStop[stop.zh] ?? (stop.it || stop.zh);
        const isPreviousGeneratedPlaceUrl = stop.mapsUrl === legacyGoogleMapsPlaceUrl(placeName, lat, lng);
        if (stop.mapsUrl && !isGeneratedCoordinateMapsUrl(stop.mapsUrl) && !isPreviousGeneratedPlaceUrl) return stop;
        return { ...stop, lat, lng, mapsUrl: googleMapsPlaceUrl(placeName) };
      }),
    })),
  };
}

export const dateOf = (index: number) => `2027-01-${String(index + 2).padStart(2, "0")}`;

export function departure(arrival: string, minutes: number) {
  if (!arrival || minutes === 0) return "待設定";
  const [hours, mins] = arrival.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const nextDays = Math.floor(total / 1440);
  const time = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return `${nextDays ? `次日${nextDays > 1 ? ` +${nextDays - 1} 天` : ""} ` : ""}${time}`;
}

export function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `stop-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function coordinatesFromGoogleMapsUrl(value: string): { lat: number; lng: number } | null {
  if (!value) return null;
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* 保留原字串繼續比對 */ }
  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?).*?!4d(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:query|q)=(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
}

export function blankStop(): Stop {
  return {
    id: makeId(), zh: "新增景點", it: "", kind: "self", status: "pending",
    story: "", source: "", image: "", imageSource: "", credit: "", licenseName: "", license: "", mapsUrl: "",
    suggested: 60, minutes: 60, arrival: "", openingHours: "", estimatedCostEur: null, transportMinutes: null, transportMode: "", note: "", lat: null, lng: null,
  };
}

function agencyStop(zh: string, it: string, story: string, note = ""): Stop {
  return {
    ...blankStop(), zh, it, story, note, kind: "agency", status: "pending",
    suggested: 0, minutes: 0,
  };
}

const commons = "https://commons.wikimedia.org";
const official = "https://www.veneziaunica.it/en/things-to-do-in-venice";

export function initialTrip(): Trip {
  const source = "旅行社截圖附件：524076.jpg、S__145481733_0.jpg～S__145481749_0.jpg（細節仍須以最終說明會資料及領隊通知為準）";
  const logistics = () => ({ wakeUp: "", breakfast: "", meeting: "", meetingPlace: "", luggage: "pending" as const, reminder: "" });
  const days: Day[] = [
    {
      date: dateOf(0), title: "台北 → 羅馬", logistics: logistics(), flights: [{
        id: makeId(), airline: "中華航空", flightNumber: "CI075",
        departureAirport: "桃園國際機場", arrivalAirport: "羅馬達文西機場",
        departureAt: "2027-01-02T23:25", arrivalAt: "2027-01-03T07:05",
        departureTimezone: "Asia/Taipei", arrivalTimezone: "Europe/Rome",
        duration: "約 14 小時 40 分鐘", terminal: "待旅行社通知", note: "參考航班；最終以旅行社說明會資料為準。",
      }], agencySource: source,
      agencyOriginal: "台北搭機前往義大利羅馬，夜宿機上。\n參考航班：2027/01/02 23:25 桃園機場出發，2027/01/03 07:05 抵達羅馬達文西機場；中華航空 CI075，飛行時間約 14 小時 40 分鐘。\n餐食：晚餐為機上輕食。\n提醒：團體航班與機位依航空公司安排，出發前須繳交護照資料。",
      note: "航班時間僅為參考，最終以旅行社說明會資料為準；集合時間與航廈待確認。", stops: [],
    },
    {
      date: dateOf(1), title: "羅馬 → 佛羅倫斯市區觀光", logistics: logistics(), flights: [], agencySource: source,
      agencyOriginal: "羅馬－314km－佛羅倫斯市區觀光。安排住宿佛羅倫斯老城區飯店一晚。\n景點：佛羅倫斯老城區、文藝復興之都、聖母百花大教堂、老橋、領主廣場。\n餐食：早餐機上輕食；午餐托斯卡尼風味料理；晚餐中式料理六菜一湯。\n候選旅館：C-Hotels 系列、MH Hotel、Hotel Leonardo、Albani、Starhotels 或同級。",
      note: "大型遊覽車停靠受老城區法規限制，圖片提醒準備一日過夜包；實際飯店待確認。",
      stops: [
        agencyStop("文藝復興之都～佛羅倫斯市區觀光", "Firenze · visita della città", "佛羅倫斯以文藝復興文化、博物館、教堂與公共廣場聞名；旅行社原稿將此段列為市區觀光。"),
        agencyStop("聖母百花大教堂", "Cattedrale di Santa Maria del Fiore", "佛羅倫斯主教座堂建築群由教堂、洗禮堂與鐘樓構成。旅行社圖片註明團體未專程安排入內，若有空檔可自行參觀。", "是否入內、排隊與開放情況須現場確認。"),
        agencyStop("佛羅倫斯老橋", "Ponte Vecchio", "橫跨阿諾河的老橋以橋上商店聞名，是佛羅倫斯的重要地標。"),
        agencyStop("領主廣場", "Piazza della Signoria", "領主廣場長期是佛羅倫斯政治與公共生活中心，周邊可見舊宮與雕塑。"),
      ],
    },
    {
      date: dateOf(2), title: "佛羅倫斯 → 威尼斯本島", logistics: logistics(), flights: [], agencySource: source,
      agencyOriginal: "佛羅倫斯－297km－威尼斯，搭船前往威尼斯本島，行程標示聖馬可廣場、嘆息橋；另安排貢多拉遊船（五人一船）。\n餐食：早餐飯店團體自助式；午餐中式料理六菜一湯；晚餐義式墨魚汁麵、炸海鮮拼盤與提拉米蘇。\n候選旅館：Novotel Mestre、Mercure Marghera、Belstay、Leonardo Royal 或同級。",
      note: "船班、上下船點、步行距離及貢多拉安排待旅行社最終確認。",
      stops: [agencyStop("威尼斯本島", "Venezia", "威尼斯由潟湖中的島嶼、運河與橋梁構成。旅行社原稿列出聖馬可廣場、嘆息橋及周邊漫步。", "照片中另列貢多拉遊船安排；實際時段與天候限制待確認。")],
    },
    {
      date: dateOf(3), title: "威尼斯全日自由活動", logistics: logistics(), flights: [], agencySource: source,
      agencyOriginal: "威尼斯全日自由活動，交通與餐食自理。圖片另提供多洛米緹湖區小鎮一日遊自費參考：100 歐、15 人成團，08:00 飯店出發，奧隆佐湖、密蘇里納湖、科蒂納丹佩佐，16:30 返回威尼斯，19:00 中式晚餐，20:00 抵達飯店；行程與時間依路況、纜車營運及成團狀況調整。\n餐食：早餐飯店團體自助式；午、晚餐自由活動自理。\n候選旅館：Novotel Mestre、Mercure Marghera、Belstay、Leonardo Royal 或同級。",
      note: "威尼斯自由活動。住宿、集合地點及交通仍待確認；下列四站為使用者自行規劃草案，各站交通時間另計。",
      stops: [],
    },
    {
      date: dateOf(4), title: "威尼斯 → 米蘭市區觀光 → 米蘭周圍", logistics: logistics(), flights: [], agencySource: source,
      agencyOriginal: "威尼斯－278km－米蘭市區觀光－米蘭周圍。\n景點：米蘭、米蘭大教堂、艾曼紐二世拱廊。\n餐食：早餐飯店團體自助式；午餐中式料理六菜一湯；晚餐米蘭傳統風味料理。\n候選旅館：H/I nord zara、Belstay assago、Klima Hotel、Novotel MXP 或同級。",
      note: "車程、下車點、參觀順序與飯店待旅行社最終確認。",
      stops: [
        agencyStop("米蘭市區觀光", "Milano · visita della città", "旅行社原稿將米蘭安排為市區觀光，介紹其藝術、時尚與商業特色。"),
        agencyStop("米蘭大教堂", "Duomo di Milano", "米蘭大教堂是米蘭的重要地標，以白色大理石外觀與哥德式建築聞名。"),
        agencyStop("艾曼紐二世拱廊", "Galleria Vittorio Emanuele II", "拱廊於 19 世紀興建，十字形玻璃穹頂空間連接米蘭市中心的重要廣場。"),
      ],
    },
    {
      date: dateOf(5), title: "米蘭 → 波隆那 → 羅馬", logistics: logistics(), flights: [], agencySource: source,
      agencyOriginal: "米蘭－221km－大學城波隆那，續搭高速火車前往羅馬。\n餐食：早餐飯店團體自助式；午餐方便遊玩敬請自理；晚餐羅馬音樂餐廳風味料理。\n候選旅館：The Caesar Roma、Marriott Park、Sheraton Parco、Warmth Hotel、Mercure west、Novotel est 或同級。",
      note: "高速火車班次、車站與行李搬運方式待旅行社最終確認。",
      stops: [agencyStop("波隆那", "Bologna", "旅行社原稿介紹波隆那為歷史悠久的大學城與美食城市，市區可見中世紀建築、廣場與雙塔。")],
    },
    {
      date: dateOf(6), title: "羅馬一日自由活動", logistics: logistics(), flights: [], agencySource: source,
      agencyOriginal: "羅馬全日自由活動，交通餐食自理；連泊羅馬。圖片另提供古羅馬深度遊自費行程，可向領隊報名。\n餐食：早餐飯店團體自助式；午、晚餐自理。\n候選旅館：The Caesar Roma、Marriott Park、Sheraton Parco、Warmth Hotel、Mercure west、Novotel est 或同級。",
      note: "自由活動期間自行安排；自費古羅馬行程每位成人／小孩 140 歐元，最低 15 人成團，危險等級 C，實際集合與成團資訊待確認。",
      stops: [agencyStop("古羅馬深度遊（自費行程）", "Roma antica · escursione facoltativa", "圖片中的自費行程介紹聖彼得大教堂、羅馬競技場、古羅馬市集、四河噴泉、萬神殿、許願池等地標，並提及羅馬城市博物館。", "旅行社提供的自費選項：成人與小孩皆 140 歐元、最低 15 人成團、危險等級 C；如遇宗教活動，聖彼得大教堂可能不對外開放。尚未確認參加或預訂。")],
    },
    {
      date: dateOf(7), title: "羅馬一日自由活動", logistics: logistics(), flights: [], agencySource: source,
      agencyOriginal: "羅馬全日自由活動，交通餐食自理。\n餐食：早餐飯店團體自助式；午、晚餐自理。\n候選旅館：The Caesar Roma、Marriott Park、Sheraton Parco、Warmth Hotel、Mercure west、Novotel est 或同級。",
      note: "尚無具體景點與時間，保持待規劃。", stops: [],
    },
    {
      date: dateOf(8), title: "羅馬 → 台北", logistics: logistics(), flights: [{
        id: makeId(), airline: "中華航空", flightNumber: "CI076",
        departureAirport: "羅馬達文西機場", arrivalAirport: "桃園國際機場",
        departureAt: "2027-01-10T10:25", arrivalAt: "2027-01-11T05:35",
        departureTimezone: "Europe/Rome", arrivalTimezone: "Asia/Taipei",
        duration: "約 12 小時 10 分鐘", terminal: "待旅行社通知", note: "參考航班；退稅集合與最終時間待旅行社通知。",
      }], agencySource: source,
      agencyOriginal: "配合搭機與退稅時間，整理行裝後前往機場辦理退稅及出境，搭機返回台北；因時差與飛行時間關係，班機隔日抵達，夜宿機上。\n參考航班：2027/01/10 10:25 羅馬達文西機場出發，2027/01/11 05:35 抵達桃園機場；中華航空 CI076，飛行時間約 12 小時 10 分鐘。\n餐食：早餐為飯店早餐或餐盒；午、晚餐為機上輕食。",
      note: "航班時間僅為參考；早餐形式、退稅集合時間與航廈待旅行社最終確認。", stops: [],
    },
    {
      date: dateOf(9), title: "抵達台北", logistics: logistics(), flights: [], agencySource: source,
      agencyOriginal: "抵達台北，旅程結束。",
      note: "實際抵達時間待航班確認。", stops: [],
    },
  ];
  days[0].stops = [
    {
      ...agencyStop(
        "桃園國際機場｜搭機前往羅馬",
        "Aeroporto Internazionale di Taoyuan",
        "旅行社參考航班為中華航空 CI075，預計 2027/01/02 23:25 自桃園機場起飛，隔日抵達羅馬。",
        "機場集合時間、航廈、報到櫃檯與實際起飛時間待旅行社最終通知；建議依團體集合時間抵達，不以 23:25 作為到機場時間。",
      ),
      arrival: "",
    },
  ];
  days[9].stops = [
    {
      ...agencyStop(
        "桃園國際機場｜返抵台灣",
        "Aeroporto Internazionale di Taoyuan",
        "旅行社參考航班為中華航空 CI076，預計 2027/01/11 05:35 抵達桃園機場。",
        "實際抵達時間、航廈、入境與行李提領時間依當日航班及機場作業為準。",
      ),
      arrival: "05:35",
    },
  ];
  days[3].stops = [
    {
      ...blankStop(), zh: "聖馬可廣場與教堂周邊", it: "Piazza San Marco · Basilica di San Marco",
      story: "聖馬可教堂的歷史可追溯至 9 世紀，後來成為威尼斯重要的宗教與公共地標。參觀範圍與 2027 年開放資訊仍須查閱官方公告。",
      source: `${official}/other-churches-of-venice/st-mark-s-basilica`,
      image: `${commons}/wiki/Special:FilePath/Piazza_San_Marco%2C_Venice.jpg?width=960`,
      imageSource: `${commons}/wiki/File:Piazza_San_Marco,_Venice.jpg`, credit: "Tiia Monto；原圖縮放顯示",
      licenseName: "CC BY-SA 3.0", license: "https://creativecommons.org/licenses/by-sa/3.0/",
      suggested: 90, minutes: 90, arrival: "10:30", lat: 45.4342, lng: 12.3387,
      note: "自行規劃建議，尚未確認或預訂。長輩可避開攀塔並安排坐下休息。雨天縮短活動。",
    },
    { ...blankStop(), zh: "午餐及休息", it: "Pranzo e pausa", suggested: 75, minutes: 75, arrival: "12:00", note: "餐廳未選定、未預訂；優先找有座位、洗手間且可避寒的地點。" },
    {
      ...blankStop(), zh: "里亞托橋周邊", it: "Ponte di Rialto",
      story: "里亞托橋現存石橋建於 16 世紀末，是大運河的重要通道。2027 年現地狀況仍須再確認。",
      source: `${official}/monuments-and-theatres/rialto-bridge`, image: `${commons}/wiki/Special:FilePath/Rialto_bridge.jpg?width=960`,
      imageSource: `${commons}/wiki/File:Rialto_bridge.jpg`, credit: "Mex3；原圖縮放顯示",
      licenseName: "CC BY-SA 3.0", license: "https://creativecommons.org/licenses/by-sa/3.0/",
      suggested: 45, minutes: 45, arrival: "13:30", lat: 45.438, lng: 12.3359,
      note: "依長輩體力決定；橋面有階梯，可改在岸邊停留。",
    },
    { ...blankStop(), zh: "咖啡休息與返程準備", it: "Pausa caffè e preparazione al rientro", suggested: 60, minutes: 60, arrival: "14:30", note: "住宿與集合地點未確認，不能指定班次或保證準時返回。濃霧、強風或高水位時依官方公告及領隊安排。" },
  ];
  return withTransportDefaults(withEstimatedCosts(withKnownLocations(withKnownOpeningHours(withGeneratedPosters(withDay9AirportShopping(withRomeDayPlans(withVaticanMuseum(withDay3VeniceStops(TripSchema.parse({
    version: 1,
    title: "一起去義大利",
    agencyMeta: {
      tourName: "尾牙趣｜特選義大利｜羅馬三晚、水鄉威尼斯連泊、夜宿佛羅倫斯老城、流行之都米蘭、高速火車、四大名城自在遊 10 日",
      tourCode: "27EI102CIC-T",
      updatedAt: "2026/09/10 09:47",
      depositTwd: 30000,
      adultPriceTwd: 60900,
      singleRoomTwd: 15500,
      outbound: "CI075｜2027/01/02 23:25 桃園 → 2027/01/03 07:05 羅馬",
      inbound: "CI076｜2027/01/10 10:25 羅馬 → 2027/01/11 05:35 桃園",
      source,
    },
    packing: [
      ["護照與文件", "護照", "carry"], ["護照與文件", "旅行社行程與保險資料", "carry"],
      ["金錢與信用卡", "歐元現金與信用卡", "carry"], ["冬季衣物", "保暖外套", "either"],
      ["冬季衣物", "圍巾、手套與保暖帽", "either"], ["常用藥品", "個人常用藥與處方", "carry"],
      ["電子用品", "手機充電器與行動電源", "carry"], ["電子用品", "歐規轉接頭", "either"],
      ["長輩用品", "備用藥品與緊急聯絡卡", "carry"], ["每日外出小包", "水壺、紙巾與雨具", "carry"],
    ].map(([category, name, bag]) => ({ id: makeId(), category, name, checked: false, quantity: 1, bag: bag as "carry" | "checked" | "either", note: "" })),
    expenses: [],
    eurToTwd: 35,
    cashFunds: { EUR: 0, TWD: 0 },
    days,
  }))))))))));
}

