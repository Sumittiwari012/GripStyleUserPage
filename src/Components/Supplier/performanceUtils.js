// Non-UI code for the supplier performance dashboard:
// constants, API calls, formatting, event calendar, calculations, Excel export.

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "https://gripstyleapi.runasp.net"
).replace(/\/$/, "");

export const SOLD_COLOR = "#2E6E62";
export const RETURNED_COLOR = "#C2543A";
export const HIGHLIGHT_COLOR = "#D98E2B";

// Below this many units sold, a product's ranking is too noisy to trust.
export const MIN_SOLD_FOR_INSIGHT = 5;

export const DRILL_METRICS = {
  fastest: { field: "avgDays", label: "Days to sell", unit: "d", barColor: SOLD_COLOR },
  slowest: { field: "avgDays", label: "Days to sell", unit: "d", barColor: "#B08900" },
  highestReturn: { field: "returnRate", label: "Return rate", unit: "%", barColor: RETURNED_COLOR },
  lowestReturn: { field: "returnRate", label: "Return rate", unit: "%", barColor: SOLD_COLOR },
};

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function getJson(path) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/Supplier/${path}`);
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {
      // ignore
    }
    try {
      const data = JSON.parse(text);
      throw new Error(data?.message || data?.title || `Request failed (${res.status}).`);
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(text || `Request failed (${res.status}).`);
      throw e;
    }
  }
  return res.json();
}

// Invoice numbers may contain "/", which the catch-all route accepts.
const encodeInvoice = (n) => n.split("/").map(encodeURIComponent).join("/");

// Light list for the dropdown (no sales maths); the numbers load per invoice.
export const fetchInvoiceList = async (supplierId) => {
  const data = await getJson(`GetInvoices/${supplierId}`);
  return (data.invoices ?? []).map((i) => ({ id: i.invoiceNumber, date: i.purchaseDate }));
};

export const fetchInvoice = (supplierId, invoiceNumber) =>
  getJson(`GetPerformance/${supplierId}/${encodeInvoice(invoiceNumber)}`);

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export const DAY_MS = 86400000;

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function fmtMoney(n) {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

export const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
export const fmtShort = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

// Tooltip text for a product: "Name (barcode)" when a barcode exists.
export const withBarcode = (name, barcode) => (barcode ? `${name} (${barcode})` : name);

function toDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* ------------------------------------------------------------------ */
/* Event calendar                                                      */
/* ------------------------------------------------------------------ */

// Festivals move every year, so their dates are listed by hand. 2026 dates
// are filled in (plus Diwali 2027); ADD THE NEXT YEAR'S DATES here each year,
// and add your own sale days (e.g. a platform sale) as { name, start, end? }.
const MOVING_EVENTS = [
  { name: "Holi", start: "2026-03-04" },
  { name: "Raksha Bandhan", start: "2026-08-28" },
  { name: "Janmashtami", start: "2026-09-04" },
  { name: "Ganesh Chaturthi", start: "2026-09-14" },
  { name: "Navratri", start: "2026-10-11", end: "2026-10-19" },
  { name: "Durga Puja", start: "2026-10-16", end: "2026-10-21" },
  { name: "Dussehra", start: "2026-10-20" },
  { name: "Dhanteras", start: "2026-11-06" },
  { name: "Diwali", start: "2026-11-08" },
  { name: "Diwali", start: "2027-10-29" },
];

// Same date every year.
const FIXED_EVENTS = [
  { month: 1, day: 1, name: "New Year" },
  { month: 1, day: 26, name: "Republic Day" },
  { month: 2, day: 14, name: "Valentine's Day" },
  { month: 3, day: 8, name: "Women's Day" },
  { month: 8, day: 15, name: "Independence Day" },
  { month: 10, day: 2, name: "Gandhi Jayanti" },
  { month: 12, day: 25, name: "Christmas" },
];

function firstSundayOfAugust(year) {
  const d = new Date(year, 7, 1);
  d.setDate(1 + ((7 - d.getDay()) % 7));
  return d;
}

const EVENT_LIST = (() => {
  const list = MOVING_EVENTS.map((e) => ({ name: e.name, start: toDate(e.start), end: toDate(e.end ?? e.start) }));
  for (let year = 2024; year <= 2029; year++) {
    for (const e of FIXED_EVENTS) {
      const d = new Date(year, e.month - 1, e.day);
      list.push({ name: e.name, start: d, end: d });
    }
    const fd = firstSundayOfAugust(year);
    list.push({ name: "Friendship Day", start: fd, end: fd });
  }
  return list;
})();

// Events that could plausibly lift sales on `date`: shoppers buy up to 3 days
// before an event and 1 day after it. diff < 0 = before the event.
function eventsNear(date) {
  const out = [];
  for (const ev of EVENT_LIST) {
    const diff = date < ev.start ? Math.round((date - ev.start) / DAY_MS) : date > ev.end ? Math.round((date - ev.end) / DAY_MS) : 0;
    if (diff >= -3 && diff <= 1) out.push({ name: ev.name, diff });
  }
  return out.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
}

export function describeEvent(e) {
  if (e.diff === 0) return `On ${e.name}`;
  return e.diff < 0 ? `${-e.diff} day${e.diff === -1 ? "" : "s"} before ${e.name}` : `${e.diff} day after ${e.name}`;
}

/* ------------------------------------------------------------------ */
/* Chart helpers + calculations                                        */
/* ------------------------------------------------------------------ */

export function buildAxis(maxValue) {
  const axisMax = Math.max(20, Math.ceil(maxValue / 20) * 20);
  const ticks = [0, 1, 2, 3, 4].map((i) => (axisMax / 4) * i);
  return { axisMax, ticks };
}

export function sellThroughTone(pct) {
  if (pct >= 75) return "#2B8A3E";
  if (pct >= 45) return "#B08900";
  return "#C2543A";
}

export function computeTotals(lines) {
  const shipped = lines.reduce((s, l) => s + l.shipped, 0);
  const sold = lines.reduce((s, l) => s + l.sold, 0);
  const returned = lines.reduce((s, l) => s + l.returned, 0);
  const weightedDays = lines.reduce((s, l) => s + l.daysToSell * l.sold, 0);
  const soldValue = lines.reduce((s, l) => s + l.sold * l.mrp, 0);
  const returnedValue = lines.reduce((s, l) => s + l.returned * l.mrp, 0);
  return {
    soldValue,
    returnedValue,
    netValue: soldValue - returnedValue,
    shipped,
    sold,
    returned,
    returnRate: sold > 0 ? (returned / sold) * 100 : 0,
    sellThrough: shipped > 0 ? (sold / shipped) * 100 : 0,
    avgDays: sold > 0 ? weightedDays / sold : 0,
  };
}

export function buildChartData(lines) {
  const byProduct = new Map();
  for (const l of lines) {
    const entry =
      byProduct.get(l.product) ??
      { product: l.product, barcode: l.barcode || "", shipped: 0, sold: 0, returned: 0, weightedDays: 0 };
    if (!entry.barcode && l.barcode) entry.barcode = l.barcode;
    entry.shipped += l.shipped;
    entry.sold += l.sold;
    entry.returned += l.returned;
    entry.weightedDays += l.daysToSell * l.sold;
    byProduct.set(l.product, entry);
  }
  return [...byProduct.values()].map((d) => ({
    ...d,
    avgDays: d.sold > 0 ? d.weightedDays / d.sold : 0,
    returnRate: d.sold > 0 ? (d.returned / d.sold) * 100 : 0,
    sellThrough: d.shipped > 0 ? (d.sold / d.shipped) * 100 : 0,
  }));
}

export function buildInsights(chartData) {
  const eligible = chartData.filter((d) => d.sold >= MIN_SOLD_FOR_INSIGHT);
  if (eligible.length === 0) return { fastest: null, slowest: null, highestReturn: null, lowestReturn: null };
  return {
    fastest: eligible.reduce((a, b) => (b.avgDays < a.avgDays ? b : a)),
    slowest: eligible.reduce((a, b) => (b.avgDays > a.avgDays ? b : a)),
    highestReturn: eligible.reduce((a, b) => (b.returnRate > a.returnRate ? b : a)),
    lowestReturn: eligible.reduce((a, b) => (b.returnRate < a.returnRate ? b : a)),
  };
}

// Sales of THIS shipment for every calendar day since delivery, each day
// tagged with what might explain it (nearby event, weekend, salary week).
export function buildTimeline(detail) {
  if (!detail) return null;
  const startOf = (v) => {
    const d = new Date(v);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const start = startOf(detail.date);
  const ageDays = Math.max(0, Math.round((startOf(new Date()) - start) / DAY_MS));

  const soldByDay = new Map();
  for (const d of detail.daily ?? []) {
    const idx = Math.max(0, Math.round((startOf(d.date) - start) / DAY_MS));
    soldByDay.set(idx, (soldByDay.get(idx) ?? 0) + d.sold);
  }

  const points = Array.from({ length: ageDays + 1 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      index: i,
      date,
      sold: soldByDay.get(i) ?? 0,
      reasons: { events: eventsNear(date), weekend: date.getDay() === 0 || date.getDay() === 6, payday: date.getDate() <= 7 },
    };
  });

  // A "high" day sells at least twice the shipment's daily average (min 2 units).
  const avg = points.reduce((s, p) => s + p.sold, 0) / points.length;
  const threshold = Math.max(2, avg * 2);
  for (const p of points) p.isHigh = p.sold >= threshold;
  const topDays = points
    .filter((p) => p.isHigh && p.sold > 0)
    .sort((a, b) => b.sold - a.sold || a.index - b.index)
    .slice(0, 5);

  const avgOf = (arr) => (arr.length ? arr.reduce((s, p) => s + p.sold, 0) / arr.length : 0);
  const compare = (yes, no) => {
    const a = points.filter(yes);
    const b = points.filter(no);
    const bAvg = avgOf(b);
    if (a.length === 0 || b.length === 0 || bAvg === 0) return null;
    return { yesAvg: avgOf(a), noAvg: bAvg, multiple: avgOf(a) / bAvg, yesDays: a.length, noDays: b.length };
  };
  const eventLift = compare((p) => p.reasons.events.length > 0, (p) => p.reasons.events.length === 0);
  if (eventLift) {
    eventLift.names = [...new Set(points.filter((p) => p.reasons.events.length > 0).flatMap((p) => p.reasons.events.map((e) => e.name)))];
  }
  const weekendLift = compare((p) => p.reasons.weekend, (p) => !p.reasons.weekend);

  return { ageDays, points, topDays, eventLift, weekendLift, peak: topDays[0] ?? null };
}

/* ------------------------------------------------------------------ */
/* Excel export                                                        */
/* ------------------------------------------------------------------ */

export const EXPORT_KINDS = {
  BREAKDOWN: "breakdown",
  BREAKDOWN_AND_TRENDS: "breakdown+trends",
};

const xlDate = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const round1 = (n) => Math.round(n * 10) / 10;

function breakdownRows({ lines, totals }) {
  return [
    ["Invoice", "Product", "Barcode", "Variant", "MRP (INR)", "Quantity", "Sold", "Returned", "Sell-through (%)", "Avg. days to sell"],
    ...lines.map((l) => [
      l.invoiceId,
      l.product,
      l.barcode || "",
      l.variant,
      l.mrp,
      l.shipped,
      l.sold,
      l.returned,
      l.shipped > 0 ? round1((l.sold / l.shipped) * 100) : 0,
      l.daysToSell,
    ]),
    ["Total", "", "", "", "", totals.shipped, totals.sold, totals.returned, round1(totals.sellThrough), round1(totals.avgDays)],
    [],
    ["Total sold value (at MRP)", "", "", "", totals.soldValue],
    ["Less: returned value (at MRP)", "", "", "", totals.returnedValue],
    ["Net money made", "", "", "", totals.netValue],
  ];
}

// One plain table, one row per day since delivery, so it can be read top to
// bottom, sorted, filtered or charted in Excel.
const TREND_HEADERS = [
  "Date",
  "Weekday",
  "Days after delivery",
  "Units sold",
  "Cumulative units sold",
  "Unsold stock left",
  "Event nearby",
  "Weekend",
  "Salary week (1st-7th)",
  "High sales day",
];

function trendRows({ totals, timeline }) {
  if (!timeline || !timeline.points.some((p) => p.sold > 0)) {
    return [["No sales recorded for this shipment yet."]];
  }
  const yesNo = (v) => (v ? "Yes" : "No");
  let cumulative = 0;
  const days = timeline.points.map((p) => {
    cumulative += p.sold;
    return [
      xlDate(p.date),
      p.date.toLocaleDateString("en-GB", { weekday: "long" }),
      p.index,
      p.sold,
      cumulative,
      Math.max(0, totals.shipped - cumulative),
      p.reasons.events.map(describeEvent).join("; "),
      yesNo(p.reasons.weekend),
      yesNo(p.reasons.payday),
      yesNo(p.isHigh),
    ];
  });
  return [TREND_HEADERS, ...days, ["Total", "", "", cumulative]];
}

// kind: EXPORT_KINDS.BREAKDOWN -> one sheet; EXPORT_KINDS.BREAKDOWN_AND_TRENDS -> two sheets.
// xlsx is loaded on demand so it doesn't weigh down the first page load.
export async function exportToExcel(kind, data) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const addSheet = (name, rows, widths, filterRef) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    if (filterRef) ws["!autofilter"] = { ref: filterRef };
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet("Invoice breakdown", breakdownRows(data), [16, 30, 18, 16, 14, 10, 10, 10, 16, 16]);

  if (kind === EXPORT_KINDS.BREAKDOWN_AND_TRENDS) {
    const rows = trendRows(data);
    // Filter buttons on the header row, covering the days but not the Total row.
    const filterRef = rows.length > 2 ? `A1:${String.fromCharCode(64 + TREND_HEADERS.length)}${rows.length - 1}` : undefined;
    addSheet("Sales trend", rows, [14, 13, 19, 11, 22, 17, 30, 10, 21, 15], filterRef);
  }

  const safeInvoice = String(data.invoiceId).replace(/[^\w-]+/g, "_");
  const suffix = kind === EXPORT_KINDS.BREAKDOWN_AND_TRENDS ? "breakdown-and-trends" : "breakdown";
  XLSX.writeFile(wb, `Invoice-${safeInvoice}-${suffix}.xlsx`);
}