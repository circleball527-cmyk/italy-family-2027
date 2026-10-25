import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { blankStop, cashBalance, coordinatesFromGoogleMapsUrl, departure, googleMapsPlaceUrl, initialTrip, StopSchema, TripSchema, withDay3VeniceStops, withDay9AirportShopping, withEstimatedCosts, withGeneratedPosters, withKnownLocations, withKnownOpeningHours, withRomeDayPlans, withTransportDefaults, withVaticanMuseum, type Day, type Stop, type Trip } from "./model";

const LOCAL_KEY = "italy-family-2027-v5";
const FREE_DAY_INDEXES = new Set([3, 7]);
const OPTIONAL_TOUR_DAY_INDEXES = new Set([6]);

type Day4HotelKey = "novotel" | "mercure" | "belstay" | "leonardo";
const DAY4_HOTELS: Array<{ key: Day4HotelKey; name: string; area: string; address: string; walk: string; lat: number; lng: number; source: string }> = [
  { key: "novotel", name: "Novotel Venezia Mestre Castellana", area: "Mestre", address: "Via Ceccherini 21", walk: "可步行前往 Mestre 中心，但距離較長；長輩須視體力折返。", lat: 45.503769, lng: 12.234653, source: "https://all.accor.com/hotel/3307/index.en.shtml" },
  { key: "mercure", name: "Mercure Venezia Marghera", area: "Marghera", address: "Via Malamocco 14", walk: "周邊以住宅與公路環境為主，純步行方案以短程公園及休息為主。", lat: 45.476135, lng: 12.212505, source: "https://all.accor.com/hotel/8030/index.en.shtml" },
  { key: "belstay", name: "Belstay Venezia Mestre", area: "Mestre／Marghera 交界", address: "Via Rotonda Romea 1", walk: "位於交通幹道交會處，不建議長輩徒步走遠；安排飯店周邊短程活動。", lat: 45.4729, lng: 12.2148, source: "https://www.belstayhotels.it/veneziamestre/en-GB" },
  { key: "leonardo", name: "Leonardo Royal Hotel Venice Mestre", area: "Mestre 車站旁", address: "Via Ca’ Marcello 6", walk: "四個方案中最適合步行前往 Mestre 中心、M9 與 Piazza Ferretto。", lat: 45.4827, lng: 12.2348, source: "https://www.leonardo-hotels.com/venice/leonardo-royal-hotel-venice-mestre" },
];

function day4HotelPlan(key: Day4HotelKey): Stop[] {
  const hotel = DAY4_HOTELS.find((item) => item.key === key)!;
  const stop = (zh: string, it: string, arrival: string, minutes: number, lat: number | null, lng: number | null, note: string, mapsName: string, image = "/assets/travel-posters/venice-main-island.jpg"): Stop => ({
    ...blankStop(), zh, it, arrival, minutes, suggested: minutes, lat, lng, mapsUrl: googleMapsPlaceUrl(mapsName), note, image,
    estimatedCostEur: zh.includes("晚餐") ? 35 : zh.includes("午餐") ? 25 : zh.includes("點心") || zh.includes("咖啡") ? 8 : zh.includes("博物館") ? 15 : 0,
    credit: "OpenAI ImageGen；旅行手帳風格示意圖", licenseName: "AI 生成圖",
  });
  const hotelStop = stop(`候選住宿｜${hotel.name}`, hotel.name, "09:30", 20, hotel.lat, hotel.lng, `尚未確認入住。${hotel.walk} 出發前須由旅行社確認實際飯店。`, hotel.name);
  const daMicheleDinner = (): Stop => ({
    ...stop(
      "晚餐｜Da Michele Mestre",
      "Cena da Da Michele Mestre",
      "19:00",
      90,
      45.4822405,
      12.2357448,
      "位於 Mestre 車站南側，從 Leonardo Royal 步行距離很短，適合白天市中心行程結束並回飯店休息後再用餐。Google Maps 目前顯示約 €20–30／人、評分 4.5；份量偏大，可先確認長輩食量並建議訂位。若實際入住其他三間候選飯店，步行距離較長，不建議在『不搭車』條件下硬排。",
      "Da Michele Mestre",
      "/assets/travel-posters/venice-lunch.jpg",
    ),
    mapsUrl: "https://maps.app.goo.gl/Cvq8jf9oVQDMt85s9",
    openingHours: "Google Maps 目前顯示營業至 00:00；2027 年 1 月出發前須再次確認",
    estimatedCostEur: 30,
  });
  if (key === "novotel") return [
    hotelStop,
    stop("步行前往 Mestre 舊城", "Passeggiata verso il centro di Mestre", "10:00", 45, 45.4934, 12.2427, "約略步行安排，實際路線與所需時間須依 Google Maps 當日導航；長輩疲累時立即折返。", "Piazza Erminio Ferretto", "/assets/travel-posters/venice-coffee.jpg"),
    stop("Piazza Ferretto 與鐘樓周邊", "Piazza Erminio Ferretto", "10:45", 60, 45.4934, 12.2427, "Mestre 市中心的行人廣場，可安排咖啡與坐下休息。", "Piazza Erminio Ferretto"),
    stop("M9 二十世紀博物館", "M9 Museo del '900", "12:00", 90, 45.4914, 12.2422, "週二目前有開館時段，但 2027 年開放、票價與特展須出發前確認。", "M9 Museo del 900"),
    stop("午餐｜M9 District 周邊", "Pranzo nel Distretto M9", "13:45", 75, 45.4914, 12.2422, "餐廳未預訂；優先選 M9 District 內或附近有室內座位的餐廳，確認長輩飲食需求。", "M9 District ristorante Mestre", "/assets/travel-posters/venice-lunch.jpg"),
    stop("特色點心｜Mestre 傳統糕點", "Dolce veneziano e caffè", "15:15", 45, 45.4934, 12.2427, "在 Piazza Ferretto 周邊糕餅店尋找 zaleti、baicoli 或當季甜點；品項與店家當日營業待確認。", "Piazza Ferretto pasticceria", "/assets/travel-posters/venice-coffee.jpg"),
    stop("步行返回 Novotel 與休息", "Rientro a piedi al Novotel", "16:15", 60, hotel.lat, hotel.lng, "預留較長步行與長輩休息時間；天候不佳或體力不足時不勉強步行。", hotel.name, "/assets/travel-posters/venice-coffee.jpg"),
    { ...stop("晚餐｜Novotel People Bistrot", "Cena al People Bistrot", "19:00", 90, hotel.lat, hotel.lng, "飯店官方列有地中海料理 People Bistrot；尚未預訂，2027 年營業時間與團體用餐安排須確認。", "People Bistrot Novotel Venezia Mestre", "/assets/travel-posters/venice-lunch.jpg"), openingHours: "晚餐時間待飯店確認；建議預訂" },
  ];
  if (key === "leonardo") return [
    hotelStop,
    stop("M9 二十世紀博物館", "M9 Museo del '900", "10:15", 90, 45.4914, 12.2422, "由飯店步行前往；2027 年開放、票價與特展須出發前確認。", "M9 Museo del 900"),
    stop("Piazza Ferretto 與鐘樓周邊", "Piazza Erminio Ferretto", "12:00", 60, 45.4934, 12.2427, "行人廣場適合慢行、休息及找洗手間。", "Piazza Erminio Ferretto"),
    stop("午餐｜Piazza Ferretto 周邊", "Pranzo vicino a Piazza Ferretto", "13:15", 75, 45.4934, 12.2427, "餐廳未預訂；選擇行人廣場周邊有室內座位與洗手間的餐廳。", "Piazza Ferretto ristorante", "/assets/travel-posters/venice-lunch.jpg"),
    stop("特色點心｜威尼斯糕點與咖啡", "Dolce veneziano e caffè", "14:45", 45, 45.4934, 12.2427, "可尋找 zaleti、baicoli、提拉米蘇或當季甜點；實際店家及品項待現場確認。", "Piazza Ferretto pasticceria", "/assets/travel-posters/venice-coffee.jpg"),
    stop("步行返回 Leonardo Royal", "Rientro a piedi al Leonardo Royal", "15:45", 60, hotel.lat, hotel.lng, "全程步行返回飯店並安排休息；避免太晚進入車站周邊小巷。", hotel.name, "/assets/travel-posters/venice-coffee.jpg"),
    daMicheleDinner(),
  ];
  if (key === "mercure") return [
    hotelStop,
    stop("Marghera 社區短程散步", "Passeggiata breve a Marghera", "10:15", 45, null, null, "飯店周邊並非主要觀光區，只安排日間短程散步；路口或人行道狀況不佳時取消。", "Mercure Venezia Marghera"),
    stop("Parco Catene 公園", "Parco Catene", "11:15", 60, 45.4756, 12.2090, "冬季以白天短暫散步為主；實際步行入口與路況須在飯店詢問，不建議勉強前往。", "Parco Catene Marghera"),
    stop("午餐｜Marghera 步行範圍", "Pranzo a Marghera", "12:45", 75, null, null, "請飯店櫃檯推薦可安全步行抵達、有室內座位的餐廳；店家尚未選定或預訂。", "Mercure Venezia Marghera ristorante vicino", "/assets/travel-posters/venice-lunch.jpg"),
    stop("返回 Mercure 休息", "Rientro al Mercure", "14:15", 60, hotel.lat, hotel.lng, "保留下午休息時間；若步行環境不適合，直接留在飯店，不勉強外出。", hotel.name, "/assets/travel-posters/venice-coffee.jpg"),
    stop("特色點心｜M Bar 咖啡與義式小點", "Caffè e dolce al M Bar", "15:30", 45, hotel.lat, hotel.lng, "飯店官方列有 M Bar；可詢問義式咖啡、餅乾或當日甜點，品項及 2027 年營業時間待確認。", "M Bar Mercure Venezia Marghera", "/assets/travel-posters/venice-coffee.jpg"),
    { ...stop("晚餐｜Mercure M Restaurant", "Cena al M Restaurant", "19:00", 90, hotel.lat, hotel.lng, "官方資料介紹為傳統義大利與地區料理；尚未預訂，團體是否已含晚餐與 2027 年營業時間須確認。", "M Restaurant Mercure Venezia Marghera", "/assets/travel-posters/venice-lunch.jpg"), openingHours: "晚餐時間待飯店確認；官方建議預訂" },
  ];
  return [
    hotelStop,
    stop("Belstay 飯店花園與休息空間", "Giardino e spazi comuni del Belstay", "10:15", 75, hotel.lat, hotel.lng, "官方資料列有花園與公共空間；冬季是否開放及可使用範圍以飯店現場為準。", hotel.name),
    stop("飯店周邊短程散步", "Passeggiata breve nei dintorni", "11:45", 30, null, null, "周邊為郊區及交通幹道，僅在櫃檯確認安全的人行路線後散步，不穿越大型交流道。", hotel.name),
    { ...stop("午餐｜Belstay SEGUIMI Restaurant", "Pranzo al ristorante SEGUIMI", "12:30", 90, hotel.lat, hotel.lng, "官方資料顯示 SEGUIMI 提供午餐；尚未預訂，菜單與團體用餐安排須確認。", "SEGUIMI Restaurant Belstay Venezia Mestre", "/assets/travel-posters/venice-lunch.jpg"), openingHours: "目前官方：午餐 12:30–14:00；2027 年出發前確認" },
    stop("下午自由休息", "Pomeriggio libero e riposo", "14:15", 75, hotel.lat, hotel.lng, "不搭車條件下不建議由 Belstay 徒步前往 Mestre 中心或威尼斯本島。", hotel.name, "/assets/travel-posters/venice-coffee.jpg"),
    { ...stop("特色點心｜Belstay Bar", "Caffè e dolce al Belstay Bar", "15:45", 45, hotel.lat, hotel.lng, "可在飯店酒吧安排義式咖啡、餅乾或當日甜點；實際品項待確認。", "Belstay Venezia Mestre Bar", "/assets/travel-posters/venice-coffee.jpg"), openingHours: "目前官方：Bar 10:00–23:00；2027 年出發前確認" },
    { ...stop("晚餐｜Belstay SEGUIMI Restaurant", "Cena al ristorante SEGUIMI", "19:30", 90, hotel.lat, hotel.lng, "飯店內用可避免夜間走在交通幹道；尚未預訂，須確認旅行社是否已安排晚餐。", "SEGUIMI Restaurant Belstay Venezia Mestre", "/assets/travel-posters/venice-lunch.jpg"), openingHours: "目前官方：晚餐 19:30–22:30；2027 年出發前確認" },
  ];
}

function withUpdatedDay4Preset(trip: Trip): Trip {
  const day = trip.days[3];
  const activeHotel = DAY4_HOTELS.find((hotel) => day.stops[0]?.zh === `候選住宿｜${hotel.name}`);
  if (activeHotel?.key === "leonardo" && !day.stops.some((stop) => stop.zh === "晚餐｜Da Michele Mestre")) {
    const replacement = day4HotelPlan("leonardo").find((stop) => stop.zh === "晚餐｜Da Michele Mestre")!;
    return {
      ...trip,
      days: trip.days.map((item, index) => index === 3 ? {
        ...item,
        stops: item.stops.map((stop) => stop.zh === "晚餐｜Leonardo Vitruv Restaurant" ? replacement : stop),
      } : item),
    };
  }
  if (!activeHotel || day.stops.some((stop) => stop.zh.startsWith("特色點心｜")) && day.stops.some((stop) => stop.zh.startsWith("晚餐｜"))) return trip;
  return {
    ...trip,
    days: trip.days.map((item, index) => index === 3 ? { ...item, stops: day4HotelPlan(activeHotel.key) } : item),
  };
}

function loadTrip(): { trip: Trip; warning: string } {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) return { trip: initialTrip(), warning: "" };
  try {
    const parsed = TripSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { trip: withTransportDefaults(withEstimatedCosts(withUpdatedDay4Preset(withKnownLocations(withKnownOpeningHours(withGeneratedPosters(withDay9AirportShopping(withRomeDayPlans(withVaticanMuseum(withDay3VeniceStops(parsed.data)))))))))), warning: "" };
    return { trip: initialTrip(), warning: "偵測到無法讀取的舊本機資料，已暫時顯示初始行程；原資料未被刪除。" };
  } catch {
    return { trip: initialTrip(), warning: "偵測到損壞的本機資料，已暫時顯示初始行程；原資料未被刪除。" };
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Europe/Rome", month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00+01:00`));
}

function MapView({ stops, dayNumber }: { stops: Stop[]; dayNumber: number }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { scrollWheelZoom: false }).setView([42.6, 12.5], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(map);
    const points: L.LatLngExpression[] = [];
    stops.forEach((stop, index) => {
      if (stop.lat === null || stop.lng === null) return;
      const point: L.LatLngExpression = [stop.lat, stop.lng]; points.push(point);
      const label = document.createElement("span"); label.textContent = `${index + 1}. ${stop.zh}`;
      L.circleMarker(point, { radius: 10, color: "#124c46", weight: 3, fillColor: "#e3a849", fillOpacity: 1 }).addTo(map).bindPopup(label).bindTooltip(`DAY ${dayNumber}.${index + 1}`, { permanent: true, direction: "top", className: "day-marker-label", offset: [0, -8] });
    });
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 15 });
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(element.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [stops, dayNumber]);
  return <div ref={element} className="map" aria-label="當日景點互動地圖" data-testid="map" />;
}

function Photo({ stop }: { stop: Stop }) {
  const [failed, setFailed] = useState(false);
  if (!stop.image) return <div className="photo-placeholder" aria-label="尚無照片"><span>照片待補</span><small>可在編輯中加入照片與授權資訊</small></div>;
  return <figure>
    {failed ? <div className="photo-placeholder"><span>照片暫時無法載入</span><small>請由下方來源頁查看</small></div> : <img src={stop.image} alt={stop.zh} loading="lazy" onError={() => setFailed(true)} />}
    <figcaption>
      {stop.credit || "作者待補"}
      {stop.imageSource && <> · <a href={stop.imageSource} target="_blank" rel="noreferrer">照片來源</a></>}
      {stop.license && <> · <a href={stop.license} target="_blank" rel="noreferrer">{stop.licenseName || "授權"}</a></>}
    </figcaption>
  </figure>;
}

async function prepareLocalPhoto(file: File) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("請選擇 JPG、PNG 或 WebP 圖片");
  if (file.size > 15 * 1024 * 1024) throw new Error("原始照片不可超過 15 MB");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器無法處理這張照片");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/webp", 0.78);
  if (dataUrl.length > 2_500_000) throw new Error("照片壓縮後仍過大，請先裁切或選擇較小照片");
  return dataUrl;
}

function Editor({ stop, onSave, onCancel }: { stop: Stop; onSave: (stop: Stop) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(stop);
  const [error, setError] = useState("");
  const [mapMessage, setMapMessage] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const set = <K extends keyof Stop>(key: K, value: Stop[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setMapsUrl = (value: string) => {
    const coordinates = coordinatesFromGoogleMapsUrl(value);
    setDraft((current) => ({ ...current, mapsUrl: value, ...(coordinates ?? {}) }));
    setMapMessage(!value ? "" : coordinates ? `已取得座標：${coordinates.lat}, ${coordinates.lng}` : "此連結沒有可讀取的座標；可改貼瀏覽器網址列中的完整 Google Maps 網址，或在下方手動填寫座標。");
  };
  return <section className="editor" aria-label="景點編輯器">
    <div className="section-heading"><div><p className="eyebrow dark">PLAN DETAILS</p><h2>{stop.zh === "新增景點" ? "新增一站" : "修改行程"}</h2></div><button className="icon-button" type="button" onClick={onCancel} aria-label="關閉編輯">×</button></div>
    <form onSubmit={(event) => { event.preventDefault(); const result = StopSchema.safeParse(draft); if (!result.success) { setError(result.error.issues.map((issue) => issue.message).join("；")); return; } onSave(result.data); }}>
      <div className="form-grid">
        <label>中文名稱<input required maxLength={200} value={draft.zh} onChange={(e) => set("zh", e.target.value)} /></label>
        <label>義大利文名稱<input maxLength={200} value={draft.it} onChange={(e) => set("it", e.target.value)} /></label>
        <label>行程分類<select value={draft.kind} onChange={(e) => set("kind", e.target.value as Stop["kind"])}><option value="self">自行規劃</option><option value="agency">旅行社安排</option></select></label>
        <label>核對狀態<select value={draft.status} onChange={(e) => set("status", e.target.value as Stop["status"])}><option value="pending">待確認</option><option value="confirmed">已自行核對</option></select></label>
        <label>抵達（義大利時間）<input type="time" value={draft.arrival} onChange={(e) => set("arrival", e.target.value)} /></label>
        <label>建議停留（分鐘）<input type="number" min="0" max="1440" value={draft.suggested} onChange={(e) => set("suggested", Number(e.target.value))} /></label>
        <label>自訂停留（分鐘）<input type="number" min="0" max="1440" value={draft.minutes} onChange={(e) => set("minutes", Number(e.target.value))} /></label>
        <label>自動計算離開時間<output>{departure(draft.arrival, draft.minutes)}</output></label>
        <label>營業時間<input maxLength={1000} placeholder="例如：09:00–18:00；出發前再次確認" value={draft.openingHours} onChange={(e) => set("openingHours", e.target.value)} /></label>
        <label>每人預估花費（EUR）<input type="number" min="0" max="1000000" step="0.01" placeholder="留空表示待確認" value={draft.estimatedCostEur ?? ""} onChange={(e) => set("estimatedCostEur", e.target.value === "" ? null : Number(e.target.value))} /></label>
        <label>預估交通時間（分鐘）<input type="number" min="0" max="1440" placeholder="留空表示待確認" value={draft.transportMinutes ?? ""} onChange={(e) => set("transportMinutes", e.target.value === "" ? null : Number(e.target.value))} /></label>
        <label>交通方式<input list="transport-mode-options" maxLength={100} placeholder="可選擇或自行輸入" value={draft.transportMode} onChange={(e) => set("transportMode", e.target.value)} /><datalist id="transport-mode-options"><option value="遊覽車" /><option value="步行" /><option value="計程車＋步行" /><option value="大眾運輸" /><option value="火車" /><option value="船" /><option value="計程車" /></datalist></label>
      </div>
      <label>歷史故事<textarea value={draft.story} onChange={(e) => set("story", e.target.value)} /></label>
      <label>歷史資料來源（HTTPS）<input type="url" value={draft.source} onChange={(e) => set("source", e.target.value)} /></label>
      <label>行前提醒（交通／休息／備案）<textarea placeholder="例如：需預約、注意階梯、安排長輩休息或雨天備案" value={draft.note} onChange={(e) => set("note", e.target.value)} /></label>
      <details><summary>照片、授權與地圖位置</summary>
        <label>從裝置選擇照片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setPhotoMessage("正在縮圖與壓縮…"); void prepareLocalPhoto(file).then((image) => { setDraft((current) => ({ ...current, image, imageSource: "", credit: current.credit || "使用者上傳；僅儲存於本機瀏覽器", licenseName: "私人照片", license: "" })); setPhotoMessage(`已載入 ${file.name}，儲存這一站後生效。`); }).catch((uploadError) => setPhotoMessage(uploadError instanceof Error ? uploadError.message : "照片處理失敗")); }} /></label>
        {photoMessage && <p className={photoMessage.startsWith("已載入") ? "map-link-success" : "map-link-help"} role="status">{photoMessage}</p>}
        {draft.image.startsWith("data:image/") && <button type="button" className="danger compact" onClick={() => { set("image", ""); setPhotoMessage("已移除本機照片；儲存這一站後生效。"); }}>移除上傳照片</button>}
        <label>照片網址或網站圖片路徑<input type="text" inputMode="url" placeholder={draft.image.startsWith("data:image/") ? "已使用上傳照片；輸入網址可改用網路圖片" : "https://… 或 /assets/…"} value={draft.image.startsWith("data:image/") ? "" : draft.image} onChange={(e) => set("image", e.target.value)} /></label>
        <label>照片來源頁（HTTPS）<input type="url" value={draft.imageSource} onChange={(e) => set("imageSource", e.target.value)} /></label>
        <div className="form-grid"><label>作者／修改說明<input value={draft.credit} onChange={(e) => set("credit", e.target.value)} /></label><label>授權名稱<input value={draft.licenseName} onChange={(e) => set("licenseName", e.target.value)} /></label></div>
        <label>授權網址（HTTPS）<input type="url" value={draft.license} onChange={(e) => set("license", e.target.value)} /></label>
        <label>Google Maps 地點連結<input type="url" placeholder="貼上 Google Maps 景點資訊頁網址（含 /maps/place/ 與 @座標）" value={draft.mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} /></label>
        {mapMessage && <p className={mapMessage.startsWith("已取得") ? "map-link-success" : "map-link-help"} role="status">{mapMessage}</p>}
        <div className="form-grid"><label>緯度<input type="number" step="any" value={draft.lat ?? ""} onChange={(e) => set("lat", e.target.value === "" ? null : Number(e.target.value))} /></label><label>經度<input type="number" step="any" value={draft.lng ?? ""} onChange={(e) => set("lng", e.target.value === "" ? null : Number(e.target.value))} /></label></div>
      </details>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions"><button type="submit">儲存這一站</button><button type="button" className="secondary" onClick={onCancel}>取消</button></div>
    </form>
  </section>;
}

function downloadTrip(trip: Trip) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(trip, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "italy-family-2027.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printTravelBook() {
  const previousTitle = document.title;
  document.title = "一起去義大利_2027旅遊書";
  const restore = () => { document.title = previousTitle; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
  window.setTimeout(restore, 1500);
}

function TravelBook({ trip }: { trip: Trip }) {
  const eurCash = cashBalance(trip, "EUR");
  const twdCash = cashBalance(trip, "TWD");
  const baggage = (bag: Trip["packing"][number]["bag"]) => bag === "carry" ? "隨身" : bag === "checked" ? "托運" : "皆可";
  return <div className="travel-book" aria-hidden="true">
    <section className="book-cover"><p>2027 · LA NOSTRA ITALIA</p><h1>一起去義大利</h1><h2>家庭十日旅行書</h2><div className="book-cover-rule" /><strong>2027 / 1 / 2 — 1 / 11</strong><small>所有時間以 Europe/Rome 義大利當地時間表示；航班抵達時間依所在地時區。</small></section>
    {trip.days.map((day, dayIndex) => <section className="book-day" key={day.date}>
      <header><div><small>DAY {dayIndex + 1} · {day.date.replaceAll("-", "/")}</small><h2>{day.title}</h2></div><b>{formatDate(day.date)}</b></header>
      {day.note && <p className="book-lead">{day.note}</p>}
      <div className="book-info-grid"><div><span>叫早</span><b>{day.logistics.wakeUp || "待確認"}</b></div><div><span>早餐</span><b>{day.logistics.breakfast || "待確認"}</b></div><div><span>集合</span><b>{day.logistics.meeting || "待確認"}</b></div><div><span>集合地點</span><b>{day.logistics.meetingPlace || "待確認"}</b></div></div>
      {day.flights.map((flight) => <div className="book-flight" key={flight.id}><strong>✈ {flight.airline} {flight.flightNumber}</strong><span>{flight.departureAt.replace("T", " ")} {flight.departureAirport}</span><i>→</i><span>{flight.arrivalAt.replace("T", " ")} {flight.arrivalAirport}</span></div>)}
      <div className="book-stops">{day.stops.length ? day.stops.map((stop, stopIndex) => <article className="book-stop" key={stop.id}>
        {stop.image && <img src={stop.image} alt="" />}
        <div><small>STOP {String(stopIndex + 1).padStart(2, "0")} · {stop.kind === "agency" ? "旅行社安排" : "自行規劃"}</small><h3>{stop.zh}</h3><em>{stop.it}</em><p><b>抵達</b> {stop.arrival || "待設定"}　<b>停留</b> {stop.minutes ? `${stop.minutes} 分` : "待設定"}　<b>離開</b> {departure(stop.arrival, stop.minutes)}</p><p><b>交通</b> {stopIndex === 0 ? "當日第一站" : `${stop.transportMode || "待確認"} · ${stop.transportMinutes === null ? "時間待確認" : `約 ${stop.transportMinutes} 分鐘`}`}</p><p><b>每人預估</b> {stop.estimatedCostEur === null ? "待確認" : `€${stop.estimatedCostEur}／約 NT$ ${Math.round(stop.estimatedCostEur * trip.eurToTwd).toLocaleString("zh-TW")}`}</p>{stop.story && <p>{stop.story}</p>}{stop.note && <p className="book-note">提醒：{stop.note}</p>}</div>
      </article>) : <p className="book-empty">本日沒有獨立景點卡片，請以旅行社原稿與領隊通知為準。</p>}</div>
      {day.agencyOriginal && <details open className="book-agency"><summary>旅行社原稿</summary><p>{day.agencyOriginal}</p></details>}
    </section>)}
    <section className="book-appendix"><header><small>CHECKLIST</small><h2>行李清單</h2></header>{[...new Set(trip.packing.map((item) => item.category))].map((category) => <div className="book-check-group" key={category}><h3>{category}</h3>{trip.packing.filter((item) => item.category === category).map((item) => <p key={item.id}>□ {item.name} × {item.quantity}（{baggage(item.bag)}）{item.note ? `－${item.note}` : ""}</p>)}</div>)}</section>
    {trip.purchases.length > 0 && <section className="book-appendix"><header><small>SHOPPING LIST</small><h2>購買清單</h2></header>{trip.purchasePeople.map((person) => { const items = trip.purchases.filter((item) => item.person === person); return items.length ? <div className="book-check-group" key={person}><h3>{person}</h3>{items.map((item) => <div className="book-purchase-item" key={item.id}>{item.image && <img src={item.image} alt="" />}<p>{item.checked ? "☑" : "□"} {item.name} × {item.quantity}（{item.purpose}）－預估 {item.currency === "EUR" ? "€" : "NT$"} {item.estimatedCost.toLocaleString("zh-TW")} · {item.payment === "cash" ? "現金" : "信用卡"}{item.note ? `－${item.note}` : ""}</p></div>)}</div> : null; })}<p><strong>預估合計：</strong>€ {trip.purchases.filter((item) => item.currency === "EUR").reduce((sum, item) => sum + item.estimatedCost, 0).toLocaleString("zh-TW")} ＋ NT$ {trip.purchases.filter((item) => item.currency === "TWD").reduce((sum, item) => sum + item.estimatedCost, 0).toLocaleString("zh-TW")}</p></section>}
    {(trip.expenses.length > 0 || trip.cashFunds.EUR > 0 || trip.cashFunds.TWD > 0) && <section className="book-appendix"><header><small>EXPENSES</small><h2>支出與現金</h2></header><div className="book-wallets"><div><span>歐元現金</span><b>總額 € {trip.cashFunds.EUR.toFixed(2)}</b><strong>餘額 € {eurCash.balance.toFixed(2)}</strong></div><div><span>台幣現金</span><b>總額 NT$ {trip.cashFunds.TWD.toLocaleString("zh-TW")}</b><strong>餘額 NT$ {twdCash.balance.toLocaleString("zh-TW")}</strong></div></div>{trip.days.map((day, dayIndex) => { const entries = trip.expenses.filter((entry) => entry.date === day.date); return entries.length ? <div className="book-expense-day" key={day.date}><h3>Day {dayIndex + 1} · {formatDate(day.date)}</h3>{entries.map((entry) => <p key={entry.id}><span>{entry.item} · {entry.payment === "cash" ? "現金" : "信用卡"}</span><b>{entry.currency === "EUR" ? "€" : "NT$"} {entry.amount.toLocaleString("zh-TW")}</b></p>)}</div> : null; })}</section>}
  </div>;
}

function LogisticsPanel({ day, update }: { day: Day; update: (patch: Partial<Day>) => void }) {
  const set = (key: keyof Day["logistics"], value: string) => update({ logistics: { ...day.logistics, [key]: value } });
  return <section className="logistics-panel">
    <div className="section-heading"><div><p className="eyebrow dark">MORNING CALL</p><h2>集合資訊</h2></div><small>修改後自動保存</small></div>
    <div className="form-grid logistics-grid">
      <label>叫早時間<input type="time" value={day.logistics.wakeUp} onChange={(e) => set("wakeUp", e.target.value)} /></label>
      <label>早餐時間<input type="time" value={day.logistics.breakfast} onChange={(e) => set("breakfast", e.target.value)} /></label>
      <label>集合時間<input type="time" value={day.logistics.meeting} onChange={(e) => set("meeting", e.target.value)} /></label>
      <label>是否攜帶全部行李<select value={day.logistics.luggage} onChange={(e) => set("luggage", e.target.value)}><option value="pending">待確認</option><option value="yes">需要</option><option value="no">不需要</option></select></label>
    </div>
    <label>集合地點<input placeholder="例如：飯店大廳、遊覽車旁或機場櫃檯" value={day.logistics.meetingPlace} onChange={(e) => set("meetingPlace", e.target.value)} /></label>
    <label>領隊提醒／集合備註<textarea placeholder="例如：提早 10 分鐘、攜帶護照或準備一日過夜包" value={day.logistics.reminder} onChange={(e) => set("reminder", e.target.value)} /></label>
  </section>;
}

function FlightsPanel({ day }: { day: Day }) {
  if (!day.flights.length) return null;
  const showDateTime = (value: string) => value.replace("T", " ");
  return <section className="flights-panel">
    <div className="section-heading"><div><p className="eyebrow dark">FLIGHT</p><h2>航班資訊</h2></div><small>時間依各機場所在地</small></div>
    {day.flights.map((flight) => <article className="flight-card" key={flight.id}>
      <div className="flight-head"><span>✈</span><div><strong>{flight.airline} {flight.flightNumber}</strong><small>{flight.duration}</small></div></div>
      <div className="flight-route">
        <div><span>起飛</span><strong>{showDateTime(flight.departureAt)}</strong><b>{flight.departureAirport}</b><small>{flight.departureTimezone}</small></div>
        <i>→</i>
        <div><span>抵達</span><strong>{showDateTime(flight.arrivalAt)}</strong><b>{flight.arrivalAirport}</b><small>{flight.arrivalTimezone}</small></div>
      </div>
      <p><strong>航廈／集合：</strong>{flight.terminal || "待確認"}</p><p className="flight-note">{flight.note}</p>
    </article>)}
  </section>;
}

function PackingPage({ trip, setTrip }: { trip: Trip; setTrip: React.Dispatch<React.SetStateAction<Trip>> }) {
  const [draft, setDraft] = useState({ category: "自訂項目", name: "", quantity: 1, bag: "either" as "carry" | "checked" | "either", note: "" });
  const [editingItem, setEditingItem] = useState<Trip["packing"][number] | null>(null);
  const [bagFilter, setBagFilter] = useState<"all" | "carry" | "checked">("all");
  const visibleItems = trip.packing.filter((item) => bagFilter === "all" || item.bag === bagFilter || item.bag === "either");
  const groups = [...new Set(visibleItems.map((item) => item.category))];
  const checked = trip.packing.filter((item) => item.checked).length;
  const filterCount = (filter: "all" | "carry" | "checked") => trip.packing.filter((item) => filter === "all" || item.bag === filter || item.bag === "either").length;
  const updateItem = (id: string, patch: Partial<Trip["packing"][number]>) => setTrip((current) => ({ ...current, packing: current.packing.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  return <section className="tool-page">
    <div className="tool-hero"><p className="eyebrow dark">PACKING LIST</p><h2>行李清單</h2><p>已準備 {checked}／{trip.packing.length} 項</p><progress max={trip.packing.length || 1} value={checked} /></div>
    <section className="packing-filters" aria-label="依行李放置位置篩選"><div><strong>查看放在哪裡</strong><small>標示「皆可」的物品會同時出現在隨身與托運清單。</small></div><div className="packing-filter-buttons">{([['all', '全部'], ['carry', '隨身'], ['checked', '托運']] as const).map(([value, label]) => <button key={value} className={bagFilter === value ? "active" : ""} aria-pressed={bagFilter === value} onClick={() => { setBagFilter(value); setEditingItem(null); }}>{label}<span>{filterCount(value)}</span></button>)}</div></section>
    <p className="packing-filter-result">目前顯示 <strong>{visibleItems.length}</strong> 項{bagFilter === "carry" ? "隨身物品" : bagFilter === "checked" ? "托運物品" : "全部物品"}</p>
    {groups.map((group) => <section className="check-group" key={group}><h3>{group}</h3>{visibleItems.filter((item) => item.category === group).map((item) => editingItem?.id === item.id ? <div className="packing-editor" key={item.id}>
      <div className="form-grid"><label>分類<input value={editingItem.category} onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })} /></label><label>物品名稱<input value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} /></label><label>數量<input type="number" min="1" value={editingItem.quantity} onChange={(e) => setEditingItem({ ...editingItem, quantity: Math.max(1, Number(e.target.value)) })} /></label><label>放置位置<select value={editingItem.bag} onChange={(e) => setEditingItem({ ...editingItem, bag: e.target.value as typeof editingItem.bag })}><option value="carry">隨身</option><option value="checked">托運</option><option value="either">皆可</option></select></label></div>
      <label>備註<input value={editingItem.note} onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value })} /></label>
      <div className="inline-actions"><button onClick={() => { if (!editingItem.name.trim()) return; updateItem(item.id, { ...editingItem, category: editingItem.category.trim() || "自訂項目", name: editingItem.name.trim() }); setEditingItem(null); }}>儲存修改</button><button className="secondary" onClick={() => setEditingItem(null)}>取消</button></div>
    </div> : <div className={`check-item ${item.checked ? "done" : ""}`} key={item.id}>
      <input aria-label={`已準備 ${item.name}`} type="checkbox" checked={item.checked} onChange={(e) => updateItem(item.id, { checked: e.target.checked })} />
      <div><strong>{item.name}</strong><small>數量 {item.quantity} · {item.bag === "carry" ? "隨身" : item.bag === "checked" ? "托運" : "隨身或托運"}{item.note ? ` · ${item.note}` : ""}</small></div>
      <div className="packing-row-actions"><button className="secondary compact" onClick={() => setEditingItem({ ...item })}>修改</button><button className="danger compact" onClick={() => { if (confirm(`刪除「${item.name}」？`)) setTrip((current) => ({ ...current, packing: current.packing.filter((entry) => entry.id !== item.id) })); }}>刪除</button></div>
    </div>)}</section>)}
    {!visibleItems.length && <div className="empty"><span>🧳</span><h3>這個分類目前沒有物品</h3><p>可切換其他篩選，或在下方新增物品。</p></div>}
    <section className="add-panel"><h3>新增物品</h3><div className="form-grid"><label>分類<input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></label><label>物品名稱<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>數量<input type="number" min="1" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} /></label><label>放置位置<select value={draft.bag} onChange={(e) => setDraft({ ...draft, bag: e.target.value as typeof draft.bag })}><option value="carry">隨身</option><option value="checked">托運</option><option value="either">皆可</option></select></label></div><label>備註<input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label><button onClick={() => { if (!draft.name.trim()) return; setTrip((current) => ({ ...current, packing: [...current.packing, { id: crypto.randomUUID(), ...draft, category: draft.category.trim() || "自訂項目", name: draft.name.trim(), checked: false }] })); setDraft({ category: "自訂項目", name: "", quantity: 1, bag: "either", note: "" }); }}>＋ 加入清單</button></section>
  </section>;
}

function PurchasePage({ trip, setTrip }: { trip: Trip; setTrip: React.Dispatch<React.SetStateAction<Trip>> }) {
  type Purchase = Trip["purchases"][number];
  const emptyDraft = (): Omit<Purchase, "id" | "checked"> => ({ name: "", person: trip.purchasePeople[0] || "全家", purpose: trip.purchasePurposes[0] || "自己吃", quantity: 1, image: "", estimatedCost: 0, currency: "EUR", payment: "cash", note: "" });
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState("全部");
  const [purposeFilter, setPurposeFilter] = useState("全部用途");
  const [newPerson, setNewPerson] = useState("");
  const [newPurpose, setNewPurpose] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const visible = trip.purchases.filter((item) => (personFilter === "全部" || item.person === personFilter) && (purposeFilter === "全部用途" || item.purpose === purposeFilter));
  const done = trip.purchases.filter((item) => item.checked).length;
  const eurTotal = trip.purchases.filter((item) => item.currency === "EUR").reduce((sum, item) => sum + item.estimatedCost, 0);
  const twdTotal = trip.purchases.filter((item) => item.currency === "TWD").reduce((sum, item) => sum + item.estimatedCost, 0);
  const estimatedTwdTotal = Math.round(twdTotal + eurTotal * trip.eurToTwd);
  const addOption = (kind: "person" | "purpose") => {
    const value = (kind === "person" ? newPerson : newPurpose).trim();
    if (!value) return;
    setTrip((current) => kind === "person"
      ? { ...current, purchasePeople: current.purchasePeople.includes(value) ? current.purchasePeople : [...current.purchasePeople, value] }
      : { ...current, purchasePurposes: current.purchasePurposes.includes(value) ? current.purchasePurposes : [...current.purchasePurposes, value] });
    if (kind === "person") { setNewPerson(""); setDraft((current) => ({ ...current, person: value })); }
    else { setNewPurpose(""); setDraft((current) => ({ ...current, purpose: value })); }
  };
  const resetDraft = () => { setEditingId(null); setDraft(emptyDraft()); setPhotoMessage(""); };
  return <section className="tool-page purchase-page">
    <div className="tool-hero"><p className="eyebrow dark">SHOPPING LIST</p><h2>購買清單</h2><p>已購買 {done}／{trip.purchases.length} 項</p><progress max={trip.purchases.length || 1} value={done} /></div>
    <section className="purchase-options"><div className="section-heading"><div><p className="eyebrow dark">CUSTOM OPTIONS</p><h2>人物與用途</h2></div><small>可自行新增選項</small></div><div className="purchase-option-grid"><div><strong>人物</strong><div className="option-tags">{trip.purchasePeople.map((item) => <span key={item}>{item}</span>)}</div><div className="inline-add"><input aria-label="新增人物" placeholder="例如：阿姨" value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addOption("person"); }} /><button type="button" onClick={() => addOption("person")}>＋ 新增人物</button></div></div><div><strong>用途</strong><div className="option-tags">{trip.purchasePurposes.map((item) => <span key={item}>{item}</span>)}</div><div className="inline-add"><input aria-label="新增用途" placeholder="例如：伴手禮" value={newPurpose} onChange={(e) => setNewPurpose(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addOption("purpose"); }} /><button type="button" onClick={() => addOption("purpose")}>＋ 新增用途</button></div></div></div></section>
    <section className="add-panel"><h3>{editingId ? "修改購買項目" : "新增購買項目"}</h3><div className="form-grid"><label>品項名稱<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>人物<select value={draft.person} onChange={(e) => setDraft({ ...draft, person: e.target.value })}>{trip.purchasePeople.map((item) => <option key={item}>{item}</option>)}</select></label><label>用途<select value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}>{trip.purchasePurposes.map((item) => <option key={item}>{item}</option>)}</select></label><label>數量<input type="number" min="1" max="999" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Math.max(1, Number(e.target.value)) })} /></label><label>預估花費<input type="number" min="0" step="0.01" value={draft.estimatedCost} onChange={(e) => setDraft({ ...draft, estimatedCost: Math.max(0, Number(e.target.value)) })} /></label><label>幣別<select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as Purchase["currency"] })}><option value="EUR">EUR 歐元</option><option value="TWD">TWD 台幣</option></select></label><label>付款方式<select value={draft.payment} onChange={(e) => setDraft({ ...draft, payment: e.target.value as Purchase["payment"] })}><option value="cash">現金</option><option value="card">信用卡</option></select></label></div><div className="purchase-photo-fields"><label>從裝置選擇照片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setPhotoMessage("正在縮圖與壓縮…"); void prepareLocalPhoto(file).then((image) => { setDraft((current) => ({ ...current, image })); setPhotoMessage(`已載入 ${file.name}，儲存項目後生效。`); }).catch((uploadError) => setPhotoMessage(uploadError instanceof Error ? uploadError.message : "照片處理失敗")); }} /></label><label>圖片網址或網站圖片路徑<input type="text" inputMode="url" placeholder="https://… 或 /assets/…" value={draft.image.startsWith("data:image/") ? "" : draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} /></label></div>{photoMessage && <p className={photoMessage.startsWith("已載入") ? "map-link-success" : "map-link-help"} role="status">{photoMessage}</p>}{draft.image && <div className="purchase-photo-preview"><img src={draft.image} alt="購買品項預覽" /><button type="button" className="danger compact" onClick={() => { setDraft({ ...draft, image: "" }); setPhotoMessage("已移除照片；儲存項目後生效。"); }}>移除照片</button></div>}<label>備註<input placeholder="例如：品牌、口味、購買地點" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label><div className="inline-actions"><button type="button" onClick={() => { if (!draft.name.trim()) return; setTrip((current) => editingId ? { ...current, purchases: current.purchases.map((item) => item.id === editingId ? { ...item, ...draft, name: draft.name.trim() } : item) } : { ...current, purchases: [...current.purchases, { id: crypto.randomUUID(), ...draft, name: draft.name.trim(), checked: false }] }); resetDraft(); }}>{editingId ? "儲存修改" : "＋ 加入購買清單"}</button>{editingId && <button type="button" className="secondary" onClick={resetDraft}>取消</button>}</div></section>
    <section className="purchase-total" aria-label="購買清單預估合計"><div><span>歐元項目</span><strong>€ {eurTotal.toLocaleString("zh-TW")}</strong></div><div><span>台幣項目</span><strong>NT$ {twdTotal.toLocaleString("zh-TW")}</strong></div><div className="grand-total"><span>換算總計</span><strong>約 NT$ {estimatedTwdTotal.toLocaleString("zh-TW")}</strong><small>依 €1＝NT$ {trip.eurToTwd}</small></div></section>
    <section className="purchase-filters" aria-label="購買清單篩選"><label>依人物<select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}><option>全部</option>{trip.purchasePeople.map((item) => <option key={item}>{item}</option>)}</select></label><label>依用途<select value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)}><option>全部用途</option>{trip.purchasePurposes.map((item) => <option key={item}>{item}</option>)}</select></label><strong>{visible.length} 項</strong></section>
    <div className="purchase-list">{visible.map((item) => <article className={`purchase-row ${item.checked ? "done" : ""}`} key={item.id}><input aria-label={`已購買 ${item.name}`} type="checkbox" checked={item.checked} onChange={(e) => setTrip((current) => ({ ...current, purchases: current.purchases.map((entry) => entry.id === item.id ? { ...entry, checked: e.target.checked } : entry) }))} />{item.image ? <img className="purchase-item-image" src={item.image} alt={item.name} /> : <div className="purchase-item-placeholder" aria-hidden="true">🛍️</div>}<div><span>{item.person}</span><span>{item.purpose}</span><h3>{item.name}</h3><p>數量 {item.quantity} · 預估 {item.currency === "EUR" ? "€" : "NT$"} {item.estimatedCost.toLocaleString("zh-TW")} · {item.payment === "cash" ? "現金" : "信用卡"}{item.note ? ` · ${item.note}` : ""}</p></div><div className="packing-row-actions"><button className="secondary compact" onClick={() => { setEditingId(item.id); setDraft({ name: item.name, person: item.person, purpose: item.purpose, quantity: item.quantity, image: item.image, estimatedCost: item.estimatedCost, currency: item.currency, payment: item.payment, note: item.note }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>修改</button><button className="danger compact" onClick={() => { if (confirm(`刪除「${item.name}」？`)) setTrip((current) => ({ ...current, purchases: current.purchases.filter((entry) => entry.id !== item.id) })); }}>刪除</button></div></article>)}{!visible.length && <div className="empty"><span>🛍️</span><h3>目前沒有購買項目</h3><p>可從上方新增，或調整人物與用途篩選。</p></div>}</div>
  </section>;
}

function ExpensesPage({ trip, setTrip }: { trip: Trip; setTrip: React.Dispatch<React.SetStateAction<Trip>> }) {
  const [draft, setDraft] = useState({ date: "2027-01-02", category: "餐食" as Trip["expenses"][number]["category"], item: "", amount: 0, currency: "EUR" as "EUR" | "TWD", payment: "cash" as "card" | "cash", note: "" });
  const [quickEuro, setQuickEuro] = useState(0);
  const eur = trip.expenses.filter((x) => x.currency === "EUR").reduce((sum, x) => sum + x.amount, 0);
  const twd = trip.expenses.filter((x) => x.currency === "TWD").reduce((sum, x) => sum + x.amount, 0);
  const cashEur = cashBalance(trip, "EUR");
  const cashTwd = cashBalance(trip, "TWD");
  return <section className="tool-page">
    <div className="tool-hero"><p className="eyebrow dark">EXPENSES</p><h2>每日支出</h2><div className="totals"><div><span>歐元合計</span><strong>€ {eur.toFixed(2)}</strong></div><div><span>台幣合計</span><strong>NT$ {twd.toLocaleString("zh-TW")}</strong></div><div><span>約合台幣</span><strong>NT$ {(twd + eur * trip.eurToTwd).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}</strong></div></div><label className="rate">參考匯率：1 EUR = TWD <input type="number" min="0" step="0.01" value={trip.eurToTwd} onChange={(e) => setTrip((current) => ({ ...current, eurToTwd: Number(e.target.value) }))} /></label><div className="currency-calculator" aria-label="歐元台幣快速換算"><label>快速換算<input type="number" min="0" step="0.01" inputMode="decimal" value={quickEuro || ""} placeholder="輸入歐元" onChange={(e) => setQuickEuro(Number(e.target.value))} /><span>EUR</span></label><i>＝</i><output><small>約合台幣</small><strong>NT$ {(quickEuro * trip.eurToTwd).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}</strong></output></div><p className="calculator-note">換算結果依上方參考匯率估算，不會自動加入支出明細。</p></div>
    <section className="cash-wallet"><div className="section-heading"><div><p className="eyebrow dark">CASH WALLET</p><h2>現金總額與餘額</h2></div><small>只扣除「現金」支出</small></div><div className="cash-wallet-grid"><label>歐元現金總額<input type="number" min="0" step="0.01" value={trip.cashFunds.EUR || ""} placeholder="0" onChange={(e) => setTrip((current) => ({ ...current, cashFunds: { ...current.cashFunds, EUR: Number(e.target.value) } }))} /></label><output><span>歐元現金餘額</span><strong className={cashEur.balance < 0 ? "negative" : ""}>€ {cashEur.balance.toFixed(2)}</strong><small>已使用 € {cashEur.spent.toFixed(2)}</small></output><label>台幣現金總額<input type="number" min="0" step="1" value={trip.cashFunds.TWD || ""} placeholder="0" onChange={(e) => setTrip((current) => ({ ...current, cashFunds: { ...current.cashFunds, TWD: Number(e.target.value) } }))} /></label><output><span>台幣現金餘額</span><strong className={cashTwd.balance < 0 ? "negative" : ""}>NT$ {cashTwd.balance.toLocaleString("zh-TW")}</strong><small>已使用 NT$ {cashTwd.spent.toLocaleString("zh-TW")}</small></output></div></section>
    <section className="add-panel"><h3>新增一筆支出</h3><div className="form-grid"><label>日期<select value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}>{trip.days.map((day, i) => <option key={day.date} value={day.date}>Day {i + 1} · {day.date}</option>)}</select></label><label>分類<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as typeof draft.category })}>{["餐食","交通","門票","購物","住宿","其他"].map((x) => <option key={x}>{x}</option>)}</select></label><label>項目名稱<input value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })} /></label><label>金額<input type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></label><label>幣別<select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as "EUR" | "TWD" })}><option>EUR</option><option>TWD</option></select></label><label>支付方式<select value={draft.payment} onChange={(e) => setDraft({ ...draft, payment: e.target.value as "card" | "cash" })}><option value="cash">現金</option><option value="card">信用卡</option></select></label></div><label>備註<input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label><button onClick={() => { if (!draft.item.trim() || draft.amount < 0) return; setTrip((current) => ({ ...current, expenses: [...current.expenses, { id: crypto.randomUUID(), ...draft, item: draft.item.trim() }] })); setDraft({ ...draft, item: "", amount: 0, note: "" }); }}>＋ 新增支出</button></section>
    <div className="expense-list">{trip.days.map((day, i) => { const entries = trip.expenses.filter((x) => x.date === day.date); if (!entries.length) return null; return <section key={day.date}><h3>Day {i + 1} · {formatDate(day.date)}</h3>{entries.map((entry) => <div className="expense-row" key={entry.id}><span>{entry.category}</span><div><strong>{entry.item}</strong><small>{entry.payment === "card" ? "信用卡" : "現金"}{entry.note ? ` · ${entry.note}` : ""}</small></div><b>{entry.currency === "EUR" ? "€" : "NT$"} {entry.amount.toLocaleString("zh-TW")}</b><button className="danger compact" onClick={() => { if (confirm(`刪除「${entry.item}」？`)) setTrip((current) => ({ ...current, expenses: current.expenses.filter((x) => x.id !== entry.id) })); }}>刪除</button></div>)}</section>; })}{!trip.expenses.length && <div className="empty"><span>€</span><h3>尚未記錄支出</h3><p>旅途中可隨手新增每一筆花費。</p></div>}</div>
  </section>;
}

function App() {
  const loaded = useMemo(loadTrip, []);
  const [trip, setTrip] = useState(loaded.trip);
  const [selected, setSelected] = useState(3);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [message, setMessage] = useState(loaded.warning);
  const [page, setPage] = useState<"itinerary" | "packing" | "purchases" | "expenses">("itinerary");
  const importRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const preserveUnreadableLocal = useRef(Boolean(loaded.warning));
  const day = trip.days[selected];

  useEffect(() => {
    if (preserveUnreadableLocal.current) {
      preserveUnreadableLocal.current = false;
      return;
    }
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(trip));
    } catch {
      setMessage("自動保存失敗：瀏覽器本機空間不足。請匯出 JSON 備份，並移除部分上傳照片或改用較小圖片。");
    }
  }, [trip]);
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      editorRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const updateDay = (patch: Partial<Day>) => setTrip((current) => ({ ...current, days: current.days.map((item, index) => index === selected ? { ...item, ...patch } : item) }));
  const move = (index: number, direction: -1 | 1) => { const next = [...day.stops]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; updateDay({ stops: next }); };

  async function importFile(file?: File) {
    if (!file) return;
    try {
      const parsed = TripSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join("；"));
      if (!confirm("匯入會覆蓋目前十日行程，確定繼續？")) { setMessage("已取消匯入，現有資料未變更。"); return; }
      const migrated = withDay3VeniceStops(parsed.data);
      const complete = withTransportDefaults(withEstimatedCosts(withKnownLocations(withKnownOpeningHours(withGeneratedPosters(withDay9AirportShopping(withRomeDayPlans(withVaticanMuseum(migrated))))))));
      setTrip(complete); setSelected(0); setEditing(null); setMessage("匯入完成，已保存於這個瀏覽器。");
    } catch (error) { setMessage(`匯入失敗：${error instanceof Error ? error.message : "檔案格式不正確"}`); }
  }

  return <>
    <header className="screen-only">
      <div className="header-inner"><div><p className="eyebrow">2027 · LA NOSTRA ITALIA</p><h1>一起去義大利</h1><p>十天，慢慢走。把冬日的風景與家人的步調，都收進同一份計畫。</p></div><div className="trip-stamp"><strong>10</strong><span>天的旅程</span><small>1/2 — 1/11</small></div></div>
    </header>
    <main className="screen-only">
      <section className="status-bar"><span className="status-dot" /> <strong>本機模式</strong><span>修改會自動存進這個瀏覽器</span><span className="timezone">Europe/Rome 義大利當地時間</span></section>
      {message && <p className={message.startsWith("匯入失敗") || message.startsWith("偵測") ? "alert" : "success"} role="status">{message}</p>}
      <details className="trip-overview">
        <summary><span>旅行社資料摘要</span><small>團號、航班與費用</small></summary>
        <div className="overview-grid">
          <div className="overview-wide"><span>行程名稱</span><strong>{trip.agencyMeta.tourName}</strong></div>
          <div><span>團號</span><strong>{trip.agencyMeta.tourCode}</strong></div>
          <div><span>資料更新</span><strong>{trip.agencyMeta.updatedAt}</strong></div>
          <div><span>成人團費</span><strong>NT$ {trip.agencyMeta.adultPriceTwd.toLocaleString("zh-TW")}</strong></div>
          <div><span>應付訂金</span><strong>NT$ {trip.agencyMeta.depositTwd.toLocaleString("zh-TW")}</strong></div>
          <div><span>單人房差</span><strong>NT$ {trip.agencyMeta.singleRoomTwd.toLocaleString("zh-TW")}</strong></div>
          <div className="overview-wide"><span>去程參考航班</span><strong>{trip.agencyMeta.outbound}</strong></div>
          <div className="overview-wide"><span>回程參考航班</span><strong>{trip.agencyMeta.inbound}</strong></div>
        </div>
        <p className="overview-source">來源：{trip.agencyMeta.source}</p>
        <p className="notice-inline">航班、旅館、行程與價格仍以旅行社最終說明會資料為準。</p>
      </details>
      <nav className="app-tabs" aria-label="網站功能"><button aria-current={page === "itinerary" ? "page" : undefined} onClick={() => setPage("itinerary")}>每日行程</button><button aria-current={page === "packing" ? "page" : undefined} onClick={() => setPage("packing")}>行李清單</button><button aria-current={page === "purchases" ? "page" : undefined} onClick={() => setPage("purchases")}>購買清單</button><button aria-current={page === "expenses" ? "page" : undefined} onClick={() => setPage("expenses")}>支出紀錄</button></nav>
      {page === "itinerary" ? <>
      <nav className="days" aria-label="選擇旅行日期">
        {trip.days.map((item, index) => <button key={item.date} className={FREE_DAY_INDEXES.has(index) ? "free-day" : OPTIONAL_TOUR_DAY_INDEXES.has(index) ? "optional-tour-day" : undefined} aria-current={index === selected ? "date" : undefined} onClick={() => { setSelected(index); setEditing(null); }}><b>DAY {index + 1}</b><span>{formatDate(item.date)}</span>{FREE_DAY_INDEXES.has(index) && <em>自由日</em>}{OPTIONAL_TOUR_DAY_INDEXES.has(index) && <em>買行程</em>}{item.stops.length > 0 && <i>{item.stops.length}</i>}</button>)}
      </nav>
      <section className="day-hero"><div><p className="eyebrow dark">DAY {selected + 1} · {day.date.replaceAll("-", "/")}</p><h2>{day.title}</h2><p>{day.note}</p></div><button onClick={() => setEditing(blankStop())}>＋ 新增一站</button></section>
      {selected === 3 && <section className="hotel-presets" aria-label="Day 4 候選飯店行程方案">
        <div className="section-heading"><div><p className="eyebrow dark">HOTEL-BASED PLANS</p><h2>四間候選飯店方案</h2></div><small>尚未確認入住 · 套用後仍可逐站編輯</small></div>
        <p className="hotel-preset-intro">四間皆位於威尼斯本島外的 Mestre／Marghera。以下是不搭車的飯店周邊步行預案，每套均含午餐、特色點心與晚餐；若最後要進威尼斯本島，仍須另外安排接駁、火車、公車或計程車。</p>
        <p className="restaurant-evaluation"><strong>Da Michele 評估：</strong>最適合入住 Leonardo Royal 時安排晚餐（19:00，約 90 分鐘），Google Maps 目前約 €20–30／人；已放入該飯店方案。若入住 Novotel、Mercure 或 Belstay，因希望不搭車且須顧及長輩步行，不建議特別前往。 <a href="https://maps.app.goo.gl/Cvq8jf9oVQDMt85s9" target="_blank" rel="noreferrer">查看餐廳 ↗</a></p>
        <div className="hotel-preset-grid">{DAY4_HOTELS.map((hotel) => {
          const active = day.stops[0]?.zh === `候選住宿｜${hotel.name}`;
          return <section key={hotel.key} className={active ? "hotel-preset-card active" : "hotel-preset-card"}>
            <span>{hotel.area}</span><h3>{hotel.name}</h3><small>{hotel.address}</small><p>{hotel.walk}</p><small>含午餐 · 特色點心 · 晚餐</small>
            <div className="inline-actions"><a href={hotel.source} target="_blank" rel="noreferrer">飯店資料 ↗</a><button className={active ? "secondary compact" : "compact"} disabled={active} onClick={() => {
              if (day.stops.length && !confirm(`套用「${hotel.name}」會取代目前 Day 4 的景點清單，確定繼續？`)) return;
              updateDay({ stops: day4HotelPlan(hotel.key), note: `候選住宿尚未確認；目前顯示 ${hotel.name} 的不搭車周邊步行預案。實際飯店與集合資訊以旅行社通知為準。` });
              setEditing(null); setMessage(`已套用 ${hotel.name} 的 Day 4 預計行程，並自動保存於本機。`);
            }}>{active ? "已套用" : "套用此方案"}</button></div>
          </section>;
        })}</div>
      </section>}
      <LogisticsPanel day={day} update={updateDay} />
      <FlightsPanel day={day} />
      <details className="agency-panel"><summary><span>旅行社原稿</span><small>{day.agencyOriginal ? "已由附件匯入" : "尚未提供"}</small></summary><label>原稿內容<textarea placeholder="收到旅行社資料後原文貼在這裡，不與自行規劃混合。" value={day.agencyOriginal} onChange={(e) => updateDay({ agencyOriginal: e.target.value })} /></label><label>原稿來源<input placeholder="例如：紙本行程、PDF 檔名或網址" value={day.agencySource} onChange={(e) => updateDay({ agencySource: e.target.value })} /></label></details>
      {editing && <div ref={editorRef} className="editor-anchor"><Editor stop={editing} onCancel={() => setEditing(null)} onSave={(saved) => { const exists = day.stops.some((stop) => stop.id === saved.id); updateDay({ stops: exists ? day.stops.map((stop) => stop.id === saved.id ? saved : stop) : [...day.stops, saved] }); setEditing(null); setMessage("已儲存，並自動保存於本機。"); }} /></div>}
      <section className="map-panel"><div className="section-heading"><div><p className="eyebrow dark">TODAY'S MAP</p><h2>今日位置</h2></div><small>DAY {selected + 1}.順序 · 點標記看名稱</small></div><MapView stops={day.stops} dayNumber={selected + 1} /></section>
      <section aria-label="每日景點清單">
        <div className="section-heading list-title"><div><p className="eyebrow dark">ITINERARY</p><h2>今日安排</h2></div><div className="list-title-actions"><strong>{day.stops.length} 站</strong><button type="button" onClick={() => setEditing(blankStop())}>＋ 新增行程</button></div></div>
        {day.stops.length === 0 ? <div className="empty"><span>✦</span><h3>這一天沒有獨立景點卡片</h3><p>{day.agencyOriginal ? "以交通、搭機或自由活動為主；詳細內容請展開旅行社原稿。" : "旅行社資料尚未取得，先保持空白，不自行臆測。"}</p><button onClick={() => setEditing(blankStop())}>新增第一站</button></div> : day.stops.map((stop, index) => <article key={stop.id}>
          <Photo stop={stop} />
          <div className="card-body"><div className="tags"><span>{stop.kind === "agency" ? "旅行社安排" : "自行規劃"}</span><span className={stop.status === "pending" ? "pending" : "confirmed"}>{stop.status === "pending" ? "待確認" : "已自行核對"}</span></div>
            <p className="stop-number">STOP {String(index + 1).padStart(2, "0")}</p><h3>{stop.zh}</h3><p className="italian">{stop.it || "義大利文名稱待補"}</p>
            <div className="time-row"><div><span>抵達</span><b>{stop.arrival || "待設定"}</b></div><div><span>停留</span><b>{stop.minutes ? `${stop.minutes} 分` : "待設定"}</b></div><div><span>離開</span><b>{departure(stop.arrival, stop.minutes)}</b></div></div>
            <p className="suggestion">建議停留 {stop.suggested ? `${stop.suggested} 分鐘` : "待設定"}</p>
            <div className="transport-summary"><span>{index === 0 ? "交通起點" : "由上一站前往"}</span><strong>{index === 0 ? "當日第一站" : stop.transportMode || "待確認"}</strong><b>{index === 0 ? "不計交通時間" : stop.transportMinutes === null ? "交通時間待確認" : `約 ${stop.transportMinutes} 分鐘`}</b></div>
            <p className="estimated-cost"><strong>每人預估花費</strong>{stop.estimatedCostEur === null ? "待確認" : `€${stop.estimatedCostEur.toLocaleString("zh-TW")} ／ 約 NT$ ${Math.round(stop.estimatedCostEur * trip.eurToTwd).toLocaleString("zh-TW")}`}<small>以 €1＝NT$ {trip.eurToTwd} 暫估，不含交通與個人購物</small></p>
            {stop.openingHours && <p className="opening-hours"><strong>營業時間</strong>{stop.openingHours}</p>}
            {stop.story && <div className="story"><h4>在出發前，先聽一段故事</h4><p>{stop.story}</p>{stop.source && <a href={stop.source} target="_blank" rel="noreferrer">查看資料來源 ↗</a>}</div>}
            {stop.note && <p className="note"><strong>行前提醒</strong>{stop.note}</p>}
            <div className="actions"><button onClick={() => setEditing(stop)}>編輯</button>{(stop.mapsUrl || (stop.lat !== null && stop.lng !== null)) && <a className="button gold" href={stop.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=walking`} target="_blank" rel="noreferrer">開啟導航 ↗</a>}<button className="secondary square" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`上移 ${stop.zh}`}>↑</button><button className="secondary square" disabled={index === day.stops.length - 1} onClick={() => move(index, 1)} aria-label={`下移 ${stop.zh}`}>↓</button><button className="danger" onClick={() => { if (confirm(`確定刪除「${stop.zh}」？`)) updateDay({ stops: day.stops.filter((item) => item.id !== stop.id) }); }}>刪除</button></div>
          </div>
        </article>)}
      </section>
      </> : page === "packing" ? <PackingPage trip={trip} setTrip={setTrip} /> : page === "purchases" ? <PurchasePage trip={trip} setTrip={setTrip} /> : <ExpensesPage trip={trip} setTrip={setTrip} />}
      <section className="data-panel"><div><p className="eyebrow dark">YOUR DATA</p><h2>保存與備份</h2><p>每次修改都會自動保存在此瀏覽器。Supabase 尚未設定，沒有雲端同步，也不會顯示同步成功。</p></div><div className="actions"><button onClick={() => { downloadTrip(trip); setMessage("JSON 備份已開始下載。"); }}>匯出 JSON</button><button onClick={printTravelBook}>匯出／列印旅遊書 PDF</button><button className="secondary" onClick={() => importRef.current?.click()}>匯入 JSON</button><input ref={importRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></div></section>
    </main>
    <footer className="screen-only"><strong>Buon viaggio</strong><span>把時間留給家人，也留給沿途的風景。</span></footer>
    <TravelBook trip={trip} />
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);

