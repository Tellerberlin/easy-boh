/**
 * Returns the set of Berlin public holiday dates for a given year as ISO date strings (YYYY-MM-DD).
 * All German national holidays + Berlin-specific ones are included.
 * Women's Day (March 8) has been a Berlin public holiday since 2019.
 */
export function getBerlinHolidays(year: number): Set<string> {
  const holidays: Date[] = [];

  const d = (month: number, day: number) => new Date(year, month - 1, day);
  const fmt = (date: Date) => date.toISOString().slice(0, 10);

  // Fixed holidays
  holidays.push(d(1, 1));   // New Year's Day
  if (year >= 2019) {
    holidays.push(d(3, 8)); // International Women's Day (Berlin, since 2019)
  }
  holidays.push(d(5, 1));   // Labour Day
  holidays.push(d(10, 3));  // German Unity Day
  holidays.push(d(12, 25)); // Christmas Day
  holidays.push(d(12, 26)); // Boxing Day

  // Easter-based holidays (Gregorian algorithm)
  const easter = easterSunday(year);
  holidays.push(offsetDate(easter, -2));  // Good Friday
  holidays.push(offsetDate(easter, 1));   // Easter Monday
  holidays.push(offsetDate(easter, 39));  // Ascension Day (39 days after Easter)
  holidays.push(offsetDate(easter, 50));  // Whit Monday (50 days after Easter)

  return new Set(holidays.map(fmt));
}

/**
 * Count how many Berlin public holidays fall on weekdays (Mon–Fri)
 * within the given date range [start, end] inclusive.
 */
export function countBerlinHolidaysInRange(start: Date, end: Date): number {
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  let count = 0;
  for (let y = startYear; y <= endYear; y++) {
    const holidays = getBerlinHolidays(y);
    for (const iso of holidays) {
      const date = new Date(iso + "T12:00:00"); // noon to avoid DST edge cases
      if (date >= start && date <= end) {
        const dow = date.getDay(); // 0 = Sun, 6 = Sat
        if (dow >= 1 && dow <= 5) count++;
      }
    }
  }
  return count;
}

function offsetDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Anonymous Gregorian algorithm for Easter Sunday */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
