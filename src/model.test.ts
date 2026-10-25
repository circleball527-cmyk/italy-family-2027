import { describe, expect, it } from "vitest";
import { cashBalance, coordinatesFromGoogleMapsUrl, departure, googleMapsPlaceUrl, initialTrip, StopSchema, TripSchema, withDay3VeniceStops, withDay9AirportShopping, withEstimatedCosts, withGeneratedPosters, withKnownLocations, withKnownOpeningHours, withRomeDayPlans, withTransportDefaults, withVaticanMuseum } from "./model";

describe("行程資料模型", () => {
  it("建立十日正確日期，匯入十個旅行社景點並保留 1/5 自行規劃", () => {
    const trip = initialTrip();
    expect(trip.days).toHaveLength(10);
    expect(trip.days[0].date).toBe("2027-01-02");
    expect(trip.days[9].date).toBe("2027-01-11");
    expect(trip.days.flatMap((day) => day.stops).filter((stop) => stop.kind === "agency")).toHaveLength(14);
    expect(trip.days[0].stops[0].zh).toContain("桃園國際機場");
    expect(trip.days[9].stops[0].arrival).toBe("05:35");
    expect(trip.days[3].stops.every((stop) => stop.kind === "self" && stop.status === "pending")).toBe(true);
    expect(trip.days.every((day) => day.agencyOriginal.length > 0)).toBe(true);
    expect(trip.days.every((day) => day.agencySource.includes("524076.jpg"))).toBe(true);
    expect(trip.agencyMeta.tourCode).toBe("27EI102CIC-T");
    expect(trip.agencyMeta.outbound).toContain("CI075");
    expect(trip.agencyMeta.inbound).toContain("CI076");
    expect(trip.days[0].flights[0].departureAt).toBe("2027-01-02T23:25");
    expect(trip.days[8].flights[0].arrivalTimezone).toBe("Asia/Taipei");
    expect(trip.days.every((day) => day.logistics.luggage === "pending")).toBe(true);
    expect(trip.packing.length).toBeGreaterThan(5);
    expect(trip.purchasePeople).toEqual(["爸爸", "媽媽", "妹妹", "姊姊", "全家"]);
    expect(trip.purchasePurposes).toEqual(["給同事", "給朋友", "自己吃"]);
    expect(trip.purchases).toEqual([]);
    expect(trip.expenses).toEqual([]);
    expect(trip.eurToTwd).toBe(35);
    expect(trip.days[1].stops.every((stop) => stop.image.startsWith("/assets/travel-posters/"))).toBe(true);
  });

  it("依日期補上交通方式預設，且保留自行修改內容", () => {
    const trip = initialTrip();
    expect(trip.days[0].stops[0].transportMode).toBe("遊覽車");
    expect(trip.days[3].stops[0].transportMode).toBe("步行");
    expect(trip.days[4].stops[0].transportMode).toBe("步行");
    expect(trip.days[6].stops.map((stop) => stop.transportMode)).toEqual(["步行", "遊覽車", "遊覽車", "遊覽車", "步行", "步行", "步行", "步行"]);
    expect(trip.days[7].stops.every((stop) => stop.transportMode === "步行")).toBe(true);
    expect(trip.days[2].stops[0].transportMinutes).toBeNull();
    expect(trip.days[2].stops[1].transportMinutes).not.toBeNull();
    expect(trip.days[2].stops[1].transportMinutes).toBeGreaterThan(0);
    trip.days[0].stops[0].transportMode = "火車";
    trip.days[0].stops[0].transportMinutes = 42;
    expect(withTransportDefaults(trip).days[0].stops[0].transportMode).toBe("火車");
    expect(withTransportDefaults(trip).days[0].stops[0].transportMinutes).toBe(42);
    trip.days[6].stops[1].transportMode = "計程車";
    trip.days[6].stops[1].transportMinutes = 9;
    expect(withTransportDefaults(trip).days[6].stops[1]).toMatchObject({ transportMode: "計程車", transportMinutes: 9 });
    const first = trip.days[2].stops[0];
    const second = trip.days[2].stops[1];
    trip.days[2].stops = [
      { ...first, arrival: "10:00", minutes: 60, lat: null, lng: null, transportMinutes: null },
      { ...second, arrival: "11:30", lat: null, lng: null, transportMinutes: null },
    ];
    expect(withTransportDefaults(trip).days[2].stops[1].transportMinutes).toBe(30);
  });

  it("Day 3 新增聖馬可廣場與嘆息橋，並可重複遷移而不複製", () => {
    const trip = initialTrip();
    const day3 = trip.days[2];
    expect(day3.stops.map((stop) => stop.zh)).toEqual(["威尼斯本島", "聖馬可廣場", "嘆息橋"]);
    expect(day3.stops.find((stop) => stop.zh === "聖馬可廣場")?.mapsUrl).toContain("Piazza%20San%20Marco");
    expect(day3.stops.find((stop) => stop.zh === "嘆息橋")?.mapsUrl).toContain("Ponte%20dei%20Sospiri");
    expect(withDay3VeniceStops(trip).days[2].stops.filter((stop) => ["聖馬可廣場", "嘆息橋"].includes(stop.zh))).toHaveLength(2);
  });

  it("計算一般與跨午夜離開時間", () => {
    expect(departure("10:30", 90)).toBe("12:00");
    expect(departure("23:30", 90)).toBe("次日 01:00");
    expect(departure("23:30", 1530)).toBe("次日 +1 天 01:00");
    expect(departure("", 90)).toBe("待設定");
  });

  it("從常見 Google Maps 完整網址擷取座標", () => {
    expect(coordinatesFromGoogleMapsUrl("https://www.google.com/maps/place/Duomo/@45.464098,9.191926,17z")).toEqual({ lat: 45.464098, lng: 9.191926 });
    expect(coordinatesFromGoogleMapsUrl("https://www.google.com/maps/search/?api=1&query=45.4380%2C12.3359")).toEqual({ lat: 45.438, lng: 12.3359 });
    expect(coordinatesFromGoogleMapsUrl("https://maps.app.goo.gl/example")).toBeNull();
  });

  it("以景點名稱產生 Google Maps 地點資訊頁網址", () => {
    expect(googleMapsPlaceUrl("Musei Vaticani")).toBe("https://www.google.com/maps/search/?api=1&query=Musei%20Vaticani");
  });

  it("舊支出資料未含支付方式時，以現金向下相容", () => {
    const oldTrip = initialTrip() as unknown as Record<string, unknown>;
    oldTrip.expenses = [{ id: "old-1", date: "2027-01-02", category: "購物", item: "測試", amount: 10, currency: "EUR", note: "" }];
    const parsed = TripSchema.parse(oldTrip);
    expect(parsed.expenses[0].payment).toBe("cash");
  });

  it("舊資料未含現金總額時，自動建立歐元與台幣錢包", () => {
    const oldTrip = initialTrip() as unknown as Record<string, unknown>;
    delete oldTrip.cashFunds;
    expect(TripSchema.parse(oldTrip).cashFunds).toEqual({ EUR: 0, TWD: 0 });
  });

  it("購買清單舊資料未含圖片時可向下相容", () => {
    const oldTrip = initialTrip() as unknown as Record<string, unknown>;
    oldTrip.purchases = [{ id: "buy-1", name: "巧克力", person: "全家", purpose: "自己吃", quantity: 1, checked: false, note: "" }];
    expect(TripSchema.parse(oldTrip).purchases[0].image).toBe("");
    expect(TripSchema.parse(oldTrip).purchases[0]).toMatchObject({ estimatedCost: 0, currency: "EUR", payment: "cash" });
  });

  it("現金餘額只扣除同幣別的現金支出", () => {
    const trip = initialTrip();
    trip.cashFunds = { EUR: 500, TWD: 3000 };
    trip.expenses = [
      { id: "cash-eur", date: "2027-01-02", category: "餐食", item: "午餐", amount: 25, currency: "EUR", payment: "cash", note: "" },
      { id: "card-eur", date: "2027-01-02", category: "購物", item: "外套", amount: 100, currency: "EUR", payment: "card", note: "" },
      { id: "cash-twd", date: "2027-01-02", category: "其他", item: "機場", amount: 300, currency: "TWD", payment: "cash", note: "" },
    ];
    expect(cashBalance(trip, "EUR")).toEqual({ spent: 25, balance: 475 });
    expect(cashBalance(trip, "TWD")).toEqual({ spent: 300, balance: 2700 });
  });

  it("為已知景點與餐飲補入每人歐元估值，未知項目保持待確認", () => {
    const trip = initialTrip();
    expect(trip.days[6].stops.find((stop) => stop.zh === "羅馬競技場")?.estimatedCostEur).toBe(18);
    expect(trip.days[7].stops.find((stop) => stop.zh === "梵蒂岡博物館")?.estimatedCostEur).toBe(25);
    expect(trip.days[8].stops.find((stop) => stop.zh.includes("Louis Vuitton"))?.estimatedCostEur).toBeNull();
    const custom = { ...trip.days[0].stops[0], id: "custom-cost", zh: "使用者新增未知景點", estimatedCostEur: null };
    trip.days[0].stops.push(custom);
    expect(withEstimatedCosts(trip).days[0].stops.at(-1)?.estimatedCostEur).toBeNull();
  });

  it("接受經瀏覽器壓縮後的本機照片資料", () => {
    const stop = initialTrip().days[0].stops[0];
    expect(StopSchema.safeParse({ ...stop, image: "data:image/webp;base64,UklGRg==" }).success).toBe(true);
  });

  it("只替空白或既有 Commons 圖片套用生成海報，不覆蓋使用者圖片", () => {
    const trip = initialTrip();
    trip.days[1].stops[0].image = "https://example.com/my-photo.jpg";
    expect(withGeneratedPosters(trip).days[1].stops[0].image).toBe("https://example.com/my-photo.jpg");
  });

  it("將拱廊舊版生成圖更新為四人家庭版", () => {
    const trip = initialTrip();
    const galleria = trip.days[4].stops.find((stop) => stop.zh === "艾曼紐二世拱廊");
    expect(galleria?.image).toBe("/assets/travel-posters/milan-galleria-family.jpg");
    if (!galleria) throw new Error("缺少艾曼紐二世拱廊");
    galleria.image = "/assets/travel-posters/milan-galleria.jpg";
    const migrated = withGeneratedPosters(trip).days[4].stops.find((stop) => stop.zh === "艾曼紐二世拱廊");
    expect(migrated?.image).toBe("/assets/travel-posters/milan-galleria-family.jpg");
  });

  it("將 Day 1 舊機場圖片升級為桃園機場旅行手帳圖，但保留使用者上傳圖片", () => {
    const trip = initialTrip();
    trip.days[0].stops[0] = { ...trip.days[0].stops[0], image: "https://example.com/old-airport.jpg", credit: "" };
    const migrated = withGeneratedPosters(trip).days[0].stops[0];
    expect(migrated.image).toBe("/assets/travel-posters/taoyuan-airport.jpg");
    expect(migrated.credit).toContain("OpenAI ImageGen");
    trip.days[0].stops[0].image = "data:image/webp;base64,UklGRg==";
    expect(withGeneratedPosters(trip).days[0].stops[0].image).toBe("data:image/webp;base64,UklGRg==");
  });

  it("替明確地名補上座標與 Google Maps 欄位，但不覆蓋使用者位置", () => {
    const trip = initialTrip();
    const located = trip.days.flatMap((day) => day.stops).filter((stop) => stop.mapsUrl);
    expect(located).toHaveLength(31);
    expect(located.every((stop) => stop.lat !== null && stop.lng !== null)).toBe(true);
    trip.days[1].stops[0] = { ...trip.days[1].stops[0], lat: 1, lng: 2, mapsUrl: "https://example.com/custom" };
    expect(withKnownLocations(trip).days[1].stops[0].lat).toBe(1);
  });

  it("將舊版座標地點網址升級為名稱搜尋網址", () => {
    const trip = initialTrip();
    const galleria = trip.days[4].stops.find((stop) => stop.zh === "艾曼紐二世拱廊");
    if (!galleria) throw new Error("缺少艾曼紐二世拱廊");
    galleria.mapsUrl = "https://www.google.com/maps/place/Galleria%20Vittorio%20Emanuele%20II/@45.4658,9.19,17z";
    const migrated = withKnownLocations(trip).days[4].stops.find((stop) => stop.zh === "艾曼紐二世拱廊");
    expect(migrated?.mapsUrl).toBe("https://www.google.com/maps/search/?api=1&query=Galleria%20Vittorio%20Emanuele%20II");
  });

  it("Day 8 含梵蒂岡博物館的位置與生成圖片，且重複遷移不會新增兩次", () => {
    const trip = initialTrip();
    const museum = trip.days[7].stops.find((stop) => stop.zh === "梵蒂岡博物館");
    expect(museum?.mapsUrl).toBe("https://www.google.com/maps/search/?api=1&query=Musei%20Vaticani");
    expect(museum?.image).toBe("/assets/travel-posters/vatican-museums.jpg");
    expect(withVaticanMuseum(trip).days[7].stops.filter((stop) => stop.zh === "梵蒂岡博物館")).toHaveLength(1);
    const museumIndex = trip.days[7].stops.findIndex((stop) => stop.zh === "梵蒂岡博物館");
    trip.days[7].stops[museumIndex] = { ...trip.days[7].stops[museumIndex], it: "", arrival: "09:00", minutes: 360, image: "https://example.com/broken.jpg", lat: null, lng: null, mapsUrl: "https://maps.app.goo.gl/example" };
    const migrated = withVaticanMuseum(trip).days[7].stops.find((stop) => stop.zh === "梵蒂岡博物館")!;
    expect(migrated.arrival).toBe("09:00");
    expect(migrated.minutes).toBe(360);
    expect(migrated.it).toBe("Musei Vaticani");
    expect(migrated.lat).toBe(41.9065);
    expect(migrated.image).toBe("/assets/travel-posters/vatican-museums.jpg");
  });

  it("Day 7 自動安排羅馬地標與許願池附近商店", () => {
    const trip = initialTrip();
    const stops = trip.days[6].stops;
    expect(stops.slice(1).map((stop) => stop.zh)).toEqual([
      "聖彼得大教堂", "羅馬競技場", "四河噴泉", "萬神殿", "許願池（特雷維噴泉）",
      "蕾莉歐 L'ERBOLARIO 專賣店", "Amorino Gelato - Roma Trevi",
    ]);
    expect(stops.find((stop) => stop.zh === "羅馬競技場")?.image).toBe("/assets/travel-posters/rome-ancient.jpg");
    expect(stops.find((stop) => stop.zh.startsWith("蕾莉歐"))?.mapsUrl).toBe("https://maps.app.goo.gl/HU9UoJkpDrdaEoacA");
    expect(withRomeDayPlans(trip).days[6].stops).toHaveLength(stops.length);
  });

  it("Day 8 將六個連結命名並依梵蒂岡周邊動線排程", () => {
    const trip = initialTrip();
    expect(trip.days[7].stops.map((stop) => stop.zh)).toEqual([
      "Dolce Maniera（早餐／烘焙）", "Panificio Bonci（麵包店）", "梵蒂岡博物館", "聖伯多祿大殿",
      "Caffè Delle Commari", "Forno Feliziani", "Todis 超市（Roma · Via Sebastiano Veniero）",
    ]);
    expect(trip.days[7].stops.map((stop) => stop.arrival)).toEqual(["08:00", "08:45", "09:30", "13:10", "15:15", "16:15", "17:00"]);
    expect(trip.days[7].stops.filter((stop) => stop.mapsUrl.startsWith("https://maps.app.goo.gl/"))).toHaveLength(6);
    expect(withRomeDayPlans(trip).days[7].stops).toHaveLength(7);
  });

  it("Day 9 新增羅馬機場 LV 代購待辦，且重複遷移不會新增兩次", () => {
    const trip = initialTrip();
    const stop = trip.days[8].stops.find((item) => item.zh.includes("Louis Vuitton"));
    expect(stop?.kind).toBe("self");
    expect(stop?.status).toBe("pending");
    expect(stop?.mapsUrl).toContain("Louis%20Vuitton%20Roma%20Fiumicino");
    expect(stop?.openingHours).toContain("06:00–22:00");
    expect(stop?.image).toBe("/assets/travel-posters/rome-fco-louis-vuitton.jpg");
    expect(withDay9AirportShopping(trip).days[8].stops.filter((item) => item.zh.includes("Louis Vuitton"))).toHaveLength(1);
  });

  it("所有景點都有旅行手帳圖片，並為已查詢商家補入營業時間", () => {
    const trip = initialTrip();
    expect(trip.days.flatMap((day) => day.stops).filter((stop) => !stop.image).map((stop) => stop.zh)).toEqual([]);
    expect(trip.days[6].stops.find((stop) => stop.zh.includes("Amorino"))?.openingHours).toContain("11:00");
    expect(trip.days[7].stops.find((stop) => stop.zh.includes("Todis"))?.openingHours).toContain("08:00–21:00");
    const custom = trip.days[7].stops.find((stop) => stop.zh.includes("Todis"))!;
    custom.openingHours = "使用者自訂";
    expect(withKnownOpeningHours(trip).days[7].stops.find((stop) => stop.zh.includes("Todis"))?.openingHours).toBe("使用者自訂");
  });

  it("拒絕日期、分鐘、連結及重複 ID 錯誤", () => {
    const wrongDate = initialTrip(); wrongDate.days[0].date = "2027-02-01";
    expect(TripSchema.safeParse(wrongDate).success).toBe(false);
    const wrongMinutes = initialTrip(); wrongMinutes.days[3].stops[0].minutes = -1;
    expect(TripSchema.safeParse(wrongMinutes).success).toBe(false);
    const unsafe = initialTrip(); unsafe.days[3].stops[0].source = "javascript:alert(1)";
    expect(TripSchema.safeParse(unsafe).success).toBe(false);
    const duplicate = initialTrip(); duplicate.days[3].stops[1].id = duplicate.days[3].stops[0].id;
    expect(TripSchema.safeParse(duplicate).success).toBe(false);
  });
});

