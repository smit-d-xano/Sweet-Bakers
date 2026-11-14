type Any = any;

// Resolves the dashboard period (in the bakery's timezone) and its comparison window.
export default function ({ $input }: { $input: Any }) {
  const TZ = "America/New_York";
  const now = DateTime.now().setZone(TZ);
  const period = String($input.period || "day");
  let start: Any;
  let end: Any;
  let prevStart: Any;
  let prevEnd: Any;
  let bucket = "day";
  let custom = false;

  const from = $input.from ? DateTime.fromISO(String($input.from), { zone: TZ }).startOf("day") : null;
  const to = $input.to ? DateTime.fromISO(String($input.to), { zone: TZ }).startOf("day") : null;
  if (from && to && from.isValid && to.isValid && to >= from) {
    custom = true;
    start = from;
    end = to.plus({ days: 1 });
    const days = Math.round(end.diff(start, "days").days);
    prevStart = start.minus({ days });
    prevEnd = start;
    bucket = days <= 2 ? "hour" : days <= 92 ? "day" : "month";
  } else if (period === "week") {
    start = now.startOf("week");
    end = start.plus({ weeks: 1 });
    prevStart = start.minus({ weeks: 1 });
    prevEnd = start;
    bucket = "day";
  } else if (period === "month") {
    start = now.startOf("month");
    end = start.plus({ months: 1 });
    prevStart = start.minus({ months: 1 });
    prevEnd = start;
    bucket = "day";
  } else if (period === "year") {
    start = now.startOf("year");
    end = start.plus({ years: 1 });
    prevStart = start.minus({ years: 1 });
    prevEnd = start;
    bucket = "month";
  } else {
    start = now.startOf("day");
    end = start.plus({ days: 1 });
    prevStart = start.minus({ days: 1 });
    prevEnd = start;
    bucket = "hour";
  }

  const nowMs = now.toMillis();
  // compare like with like: the elapsed part of this period against the same span of the previous one
  const cmpEnd = custom ? Math.min(end.toMillis(), Math.max(nowMs, start.toMillis())) : Math.min(nowMs, end.toMillis());
  const elapsed = Math.max(cmpEnd - start.toMillis(), 0);
  return {
    period: custom ? "custom" : ["day", "week", "month", "year"].includes(period) ? period : "day",
    tz: TZ,
    bucket,
    start: start.toMillis(),
    end: end.toMillis(),
    cmp_end: cmpEnd,
    prev_start: prevStart.toMillis(),
    prev_end: prevEnd.toMillis(),
    prev_cmp_end: Math.min(prevStart.toMillis() + elapsed, prevEnd.toMillis()),
    from_date: start.toFormat("yyyy-MM-dd"),
    to_date: end.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
    prev_from_date: prevStart.toFormat("yyyy-MM-dd"),
    prev_to_date: prevEnd.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
  };
}
