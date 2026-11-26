/**
 * NSE Trading Calendar & Market Holiday Helper
 * Covers standard Indian trading hours, weekends, and official NSE holidays.
 */

// List of official NSE Trading Holidays (YYYY-MM-DD) for 2025, 2026, 2027
export const NSE_HOLIDAYS = new Set([
  // 2026 Holidays
  "2026-01-26", // Republic Day
  "2026-02-17", // Mahashivratri
  "2026-03-03", // Holi
  "2026-03-20", // Id-Ul-Fitr (Ramzan Id)
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
  "2026-05-01", // Maharashtra Day
  "2026-05-27", // Bakri Id
  "2026-06-26", // Moharram
  "2026-08-15", // Independence Day
  "2026-09-04", // Milad-Un-Nabi
  "2026-10-02", // Mahatma Gandhi Jayanti
  "2026-10-20", // Dussehra
  "2026-11-08", // Diwali Laxmi Pujan
  "2026-11-10", // Diwali Balipratipada
  "2026-11-24", // Gurunanak Jayanti
  "2026-12-25", // Christmas

  // 2025 Holidays
  "2025-01-26", "2025-02-26", "2025-03-14", "2025-03-31",
  "2025-04-10", "2025-04-14", "2025-04-18", "2025-05-01",
  "2025-08-15", "2025-08-27", "2025-10-02", "2025-10-21",
  "2025-11-01", "2025-11-05", "2025-12-25"
]);

export interface MarketTimeInfo {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM:SS
  hour: number;
  minute: number;
  weekday: string; // "Mon", "Tue", etc.
  isWeekday: boolean;
  isHoliday: boolean;
  isTradingDay: boolean;
  isPast931: boolean;
  isMarketHours: boolean; // 9:15 to 15:30
}

/**
 * Get current Indian Standard Time (Asia/Kolkata) details
 */
export function getISTMarketTime(date: Date = new Date()): MarketTimeInfo {
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short"
  });

  const parts = istFormatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hour = parseInt(map.hour || "0", 10);
  const minute = parseInt(map.minute || "0", 10);
  const timeStr = `${map.hour}:${map.minute}:${map.second || "00"}`;
  const weekday = map.weekday;

  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  const isHoliday = NSE_HOLIDAYS.has(dateStr);
  const isTradingDay = isWeekday && !isHoliday;

  const totalMinutes = hour * 60 + minute;
  const isPast931 = totalMinutes >= (9 * 60 + 31);
  const isMarketHours = isTradingDay && totalMinutes >= (9 * 60 + 15) && totalMinutes <= (15 * 60 + 30);

  return {
    dateStr,
    timeStr,
    hour,
    minute,
    weekday,
    isWeekday,
    isHoliday,
    isTradingDay,
    isPast931,
    isMarketHours
  };
}
