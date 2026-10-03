import { blankTrip, blankPlace, blankItem, baseRecord } from "./model";
import type { RecordData, Trip, Item, Task } from "./model";
export function demos(owner: string): RecordData[] {
  const result: RecordData[] = [];
  function trip(name: string, start: string, end: string, cities: string) {
    const t: Trip = {
      ...blankTrip(owner),
      name,
      start,
      end,
      cities,
      demo: true,
      travelers: 3,
    };
    result.push(t);
    return t;
  }
  function place(
    t: Trip,
    name: string,
    originalName: string,
    city: string,
    category: "美食" | "景點" | "住宿" | "交通" | "其他",
    lat: number | null,
    lng: number | null,
  ) {
    const p = {
      ...blankPlace(owner, t.id, name),
      originalName,
      city,
      category,
      lat,
      lng,
      notes: "合成示範；不是目前營業、訂位或交通資訊。",
      source: "依使用者工作方式摘要製作的合成示範；未讀取 PDF 附件",
    };
    result.push(p);
    return p;
  }
  function item(
    t: Trip,
    p: ReturnType<typeof place>,
    day: string | null,
    order: number,
    extra: Partial<Item> = {},
  ) {
    const i = { ...blankItem(owner, t, p.id, day, order), ...extra };
    result.push(i);
    return i;
  }
  function task(
    t: Trip,
    title: string,
    day: string,
    time: string,
    itemId: string | null = null,
  ) {
    const x: Task = {
      ...baseRecord(owner),
      kind: "task",
      tripId: t.id,
      title,
      type: "訂票開放",
      status: "待確認",
      date: day,
      time,
      timezone: "Asia/Tokyo",
      itemId,
      url: "",
      notes: "示範截止時間，請以官方來源重新確認。",
    };
    result.push(x, {
      ...baseRecord(owner),
      kind: "reminder",
      tripId: t.id,
      targetId: x.id,
      beforeMinutes: 60,
      enabled: true,
    });
  }
  const tokyo = trip("東京 · 合成示範", "2030-01-06", "2030-01-09", "東京");
  const hotel = place(
    tokyo,
    "淺草住宿（示範）",
    "Asakusa stay",
    "東京",
    "住宿",
    null,
    null,
  );
  const temple = place(
    tokyo,
    "淺草寺",
    "浅草寺",
    "東京",
    "景點",
    35.7148,
    139.7967,
  );
  const lunch = place(
    tokyo,
    "親子午餐候選（未查證）",
    "Lunch candidate",
    "東京",
    "美食",
    null,
    null,
  );
  const museum = place(
    tokyo,
    "東京國立博物館",
    "東京国立博物館",
    "東京",
    "景點",
    35.7188,
    139.7765,
  );
  item(tokyo, hotel, "2030-01-06", 0, {
    timeMode: "flexible",
    time: "15:00",
    notes: "Check-in；實際時刻待確認",
  });
  item(tokyo, temple, "2030-01-07", 0, {
    timeMode: "period",
    period: "上午",
    travelMinutes: 15,
  });
  const fixed = item(tokyo, museum, "2030-01-07", 1, {
    timeMode: "fixed",
    time: "13:00",
    duration: 90,
    travelMinutes: 25,
    buffer: 15,
    notes: "示範預約，不代表已訂票",
  });
  item(tokyo, lunch, null, 0);
  item(tokyo, temple, "2030-01-08", 0, { timeMode: "flexible", time: "10:00" });
  result.push({
    ...baseRecord(owner),
    kind: "reminder",
    tripId: tokyo.id,
    targetId: fixed.id,
    beforeMinutes: 30,
    enabled: true,
  });
  task(tokyo, "博物館訂票開放（示範）", "2029-12-01", "10:00", fixed.id);
  const kansai = trip(
    "京都／大阪／名古屋 · 跨年示範",
    "2030-12-29",
    "2031-01-03",
    "京都、大阪、名古屋",
  );
  const kyoto = place(
    kansai,
    "京都住宿（示範）",
    "Kyoto stay",
    "京都",
    "住宿",
    null,
    null,
  );
  const station = place(
    kansai,
    "京都站",
    "京都駅",
    "京都",
    "交通",
    34.9858,
    135.7588,
  );
  const osaka = place(
    kansai,
    "大阪住宿（示範）",
    "Osaka stay",
    "大阪",
    "住宿",
    null,
    null,
  );
  const castle = place(
    kansai,
    "大阪城公園",
    "大阪城公園",
    "大阪",
    "景點",
    34.6873,
    135.5262,
  );
  const nagoya = place(
    kansai,
    "名古屋站",
    "名古屋駅",
    "名古屋",
    "交通",
    35.1709,
    136.8815,
  );
  const indoor = place(
    kansai,
    "雨天室內備案（未定位）",
    "Indoor backup",
    "大阪",
    "其他",
    null,
    null,
  );
  item(kansai, kyoto, "2030-12-29", 0, { notes: "3 位同行；示範 check-in" });
  item(kansai, kyoto, "2030-12-31", 0, {
    timeMode: "fixed",
    time: "10:00",
    duration: 15,
    notes: "示範 check-out",
  });
  item(kansai, station, "2030-12-31", 1, {
    timeMode: "fixed",
    time: "11:00",
    arrivalDay: "2030-12-31",
    arrivalTime: "11:40",
    duration: 40,
    transport: "大眾運輸",
    travelMinutes: 40,
    notes: "京都 → 大阪；手動示範交通時間",
  });
  item(kansai, osaka, "2030-12-31", 2, {
    timeMode: "flexible",
    time: "15:00",
    travelers: 2,
    notes: "住宿切換；2 位同行",
  });
  item(kansai, castle, "2031-01-01", 0, { timeMode: "period", period: "上午" });
  item(kansai, indoor, "2031-01-01", 1, { status: "candidate" });
  item(kansai, nagoya, "2031-01-02", 0, {
    timeMode: "fixed",
    time: "10:00",
    arrivalDay: "2031-01-02",
    arrivalTime: "11:00",
    travelMinutes: 60,
    transport: "大眾運輸",
    notes: "大阪 → 名古屋；不是已查證列車",
  });
  task(kansai, "跨城市車票訂票開放（示範）", "2030-11-29", "10:00");
  task(kansai, "eSIM 與寵物照顧確認", "2030-12-20", "18:00");
  return result;
}
