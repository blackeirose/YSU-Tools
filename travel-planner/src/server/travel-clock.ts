type FirestoreValue = { stringValue?: string; mapValue?: { fields?: Record<string, FirestoreValue> } };
type TripFields = Record<string, FirestoreValue> | undefined;

export type TravelClock = {
  currentInstant: string;
  destinationLocalDate: string;
  destinationLocalTime: string;
  selectedDay?: string;
  selectedDayTimezone?: string;
  timezone: string;
  tripStart?: string;
  tripEnd?: string;
};

function validZone(value: string | undefined): string | null {
  if (!value || value.length > 100) return null;
  try { return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone; }
  catch { return null; }
}

export function travelClock(fields: TripFields, selectedDay: string | undefined, now = new Date()): TravelClock | null {
  const dayZone = selectedDay && fields?.dayCities?.mapValue?.fields?.[selectedDay]?.mapValue?.fields?.timezone?.stringValue;
  const defaultZone = validZone(fields?.timezone?.stringValue);
  const selectedDayTimezone = dayZone ? validZone(dayZone) : defaultZone;
  if (!defaultZone || !selectedDayTimezone || Number.isNaN(now.getTime())) return null;
  const localParts = (timezone: string) => new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const dateIn = (zone: string) => {
    const parts = localParts(zone);
    const field = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${field("year")}-${field("month")}-${field("day")}`;
  };
  // Match App's Today choice: the first trip date whose own city clock says
  // that date is today. A future selected day must not redefine "today".
  let timezone = defaultZone;
  const start = fields?.start?.stringValue, end = fields?.end?.stringValue;
  if (start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const cursor = new Date(`${start}T00:00:00Z`);
    for (let index = 0; index < 120 && !Number.isNaN(cursor.getTime()); index++) {
      const day = cursor.toISOString().slice(0, 10);
      if (day > end) break;
      const configured = fields?.dayCities?.mapValue?.fields?.[day]?.mapValue?.fields?.timezone?.stringValue;
      const zone = configured ? validZone(configured) : defaultZone;
      if (!zone) return null;
      if (dateIn(zone) === day) { timezone = zone; break; }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const parts = localParts(timezone);
  const field = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    currentInstant: now.toISOString(),
    destinationLocalDate: `${field("year")}-${field("month")}-${field("day")}`,
    destinationLocalTime: `${field("hour")}:${field("minute")}:${field("second")}`,
    selectedDay, selectedDayTimezone, timezone,
    tripStart: start,
    tripEnd: end,
  };
}

function nextDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function relativeTarget(query: string, clock: TravelClock): { day: string; term: string; timezone: string } | null {
  if (/(?:畫面這一天|畫面選定日|選定這一天|選定日)/.test(query))
    return clock.selectedDay ? { day: clock.selectedDay, term: "畫面這一天", timezone: clock.selectedDayTimezone ?? clock.timezone } : null;
  if (/明天|明日|明早|明晚/.test(query)) return { day: nextDate(clock.destinationLocalDate), term: "明天", timezone: clock.timezone };
  if (/今天|今日|今早|今晚/.test(query)) return { day: clock.destinationLocalDate, term: "今天", timezone: clock.timezone };
  return null;
}

export function relativeAmbiguous(query: string): boolean {
  return [/(?:畫面這一天|畫面選定日|選定這一天|選定日)/.test(query), /明天|明日|明早|明晚/.test(query), /今天|今日|今早|今晚/.test(query)]
    .filter(Boolean).length > 1;
}

/** Unsupported relative dates must be clarified before any typed mutation. */
export function relativeUnsupported(query: string): boolean {
  return /後天|昨天|前天|隔天|翌日|大後天|明後天/.test(query);
}

export function inTrip(day: string, clock: TravelClock): boolean {
  return !!clock.tripStart && !!clock.tripEnd && day >= clock.tripStart && day <= clock.tripEnd;
}
