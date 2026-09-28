import { useEffect, useMemo, useState } from "react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "https://gripstyleapi.runasp.net"
).replace(/\/$/, "");

const SOLD_COLOR = "#2E6E62";
const RETURNED_COLOR = "#C2543A";
const HIGHLIGHT_COLOR = "#D98E2B";

// Below this many units sold, a product's ranking is too noisy to trust.
const MIN_SOLD_FOR_INSIGHT = 5;

const DRILL_METRICS = {
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
const fetchInvoiceList = async (supplierId) => {
  const data = await getJson(`GetInvoices/${supplierId}`);
  return (data.invoices ?? []).map((i) => ({ id: i.invoiceNumber, date: i.purchaseDate }));
};
const fetchInvoice = (supplierId, invoiceNumber) =>
  getJson(`GetPerformance/${supplierId}/${encodeInvoice(invoiceNumber)}`);

/* ------------------------------------------------------------------ */
/* Formatting + event calendar                                         */
/* ------------------------------------------------------------------ */

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(n) {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

const DAY_MS = 86400000;

function toDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const fmtShort = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

// ---- Event calendar -------------------------------------------------
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

function describeEvent(e) {
  if (e.diff === 0) return `On ${e.name}`;
  return e.diff < 0 ? `${-e.diff} day${e.diff === -1 ? "" : "s"} before ${e.name}` : `${e.diff} day after ${e.name}`;
}

function buildAxis(maxValue) {
  const axisMax = Math.max(20, Math.ceil(maxValue / 20) * 20);
  const ticks = [0, 1, 2, 3, 4].map((i) => (axisMax / 4) * i);
  return { axisMax, ticks };
}

function sellThroughTone(pct) {
  if (pct >= 75) return "#2B8A3E";
  if (pct >= 45) return "#B08900";
  return "#C2543A";
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-[#D8D2C2] bg-white px-4 py-3.5">
      <p className="text-xs font-medium text-[#5B6472]">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

function InsightCard({ eyebrow, product, metric, metricTone, detail, onClick, active }) {
  if (!product) {
    return (
      <div className="rounded-lg border border-[#D8D2C2] bg-white px-4 py-3.5">
        <p className="text-xs font-medium text-[#5B6472]">{eyebrow}</p>
        <p className="mt-2 text-sm text-[#8D8577]">Not enough sold units yet</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border bg-white px-4 py-3.5 text-left transition-colors hover:border-[#D98E2B]"
      style={{ borderColor: active ? "#D98E2B" : "#D8D2C2", boxShadow: active ? "0 0 0 1px #D98E2B" : "none" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#5B6472]">{eyebrow}</p>
        <span className="text-[10px] font-medium text-[#8D8577]">{active ? "Hide trend ▲" : "View trend ▾"}</span>
      </div>
      <p className="mt-1 truncate text-sm font-medium text-[#1B2430]" title={product}>
        {product}
      </p>
      <p className="mt-1 text-xl font-medium tracking-tight" style={{ color: metricTone }}>
        {metric}
      </p>
      {detail && <p className="mt-0.5 text-xs text-[#8D8577]">{detail}</p>}
    </button>
  );
}

function Bar({ label, sold, returned, axisMax }) {
  const soldPct = axisMax > 0 ? (sold / axisMax) * 100 : 0;
  const returnedPct = sold > 0 ? Math.min(returned / sold, 1) * 100 : 0;
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-end px-1.5">
      <div className="relative w-full max-w-[40px]" style={{ height: `${soldPct}%` }}>
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium leading-none text-[#1B2430]">
          {sold}
        </span>
        <div className="flex h-full w-full flex-col overflow-hidden rounded-t-md">
          <div className="relative flex-1" style={{ backgroundColor: SOLD_COLOR }}>
            {returned > 0 && (
              <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-semibold leading-none text-white">
                {returned}
              </span>
            )}
          </div>
          <div className="shrink-0" style={{ height: `${returnedPct}%`, backgroundColor: RETURNED_COLOR }} />
        </div>
      </div>
      <p className="mt-2 max-w-[70px] truncate text-center text-[11px] text-[#5B6472]" title={label}>
        {label}
      </p>
    </div>
  );
}

function DayBar({ point, axisMax }) {
  const pct = axisMax > 0 ? (point.sold / axisMax) * 100 : 0;
  const onEvent = point.reasons.events.find((e) => e.diff === 0);
  const pill = onEvent ?? (point.isHigh ? point.reasons.events[0] : null);
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-end px-0.5">
      <div className="relative w-full max-w-[30px]" style={{ height: `${pct}%` }}>
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium leading-none text-[#1B2430]">
          {point.sold}
        </span>
        {pill && (
          <span
            className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
            style={{ backgroundColor: HIGHLIGHT_COLOR }}
            title={describeEvent(pill)}
          >
            {pill.name}
          </span>
        )}
        <div
          className="h-full w-full rounded-t-md"
          style={{ backgroundColor: point.isHigh ? HIGHLIGHT_COLOR : SOLD_COLOR, opacity: point.isHigh ? 1 : 0.6 }}
        />
      </div>
      <p className="mt-2 whitespace-nowrap text-center text-[10px] text-[#5B6472]">{fmtShort(point.date)}</p>
      <p className="text-center text-[10px]" style={{ color: point.reasons.weekend ? HIGHLIGHT_COLOR : "#8D8577" }}>
        {point.date.toLocaleDateString(undefined, { weekday: "short" })}
      </p>
    </div>
  );
}

function RankBar({ label, value, axisMax, isHighlighted, color, unit }) {
  const pct = axisMax > 0 ? (value / axisMax) * 100 : 0;
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-end px-1">
      <div className="relative w-full max-w-[28px]" style={{ height: `${pct}%` }}>
        <span
          className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none"
          style={{ color: isHighlighted ? "#1B2430" : "#8D8577", fontWeight: isHighlighted ? 600 : 400 }}
        >
          {value.toFixed(0)}{unit}
        </span>
        <div
          className="h-full w-full rounded-t-md"
          style={{ backgroundColor: isHighlighted ? HIGHLIGHT_COLOR : color, opacity: isHighlighted ? 1 : 0.45 }}
        />
      </div>
      <p
        className="mt-2 max-w-[64px] truncate text-center text-[10px]"
        style={{ color: isHighlighted ? "#1B2430" : "#8D8577", fontWeight: isHighlighted ? 600 : 400 }}
        title={label}
      >
        {label}
      </p>
    </div>
  );
}

function Notice({ tone = "muted", children, action }) {
  const cls =
    tone === "error"
      ? "border-[#E3B7A0] bg-[#FBEEE6] text-[#8A3B1E]"
      : "border-[#D8D2C2] bg-white text-[#5B6472]";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-10 text-center text-sm ${cls}`}>
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

// supplierId: pass session.customerId (same value as the supplier id).
// Either pass supplierId/supplierName directly, or pass the login `session`
// ({ customerId, customerName }) and they are read from it.
export default function ProductPerformance({ supplierId: supplierIdProp, supplierName: nameProp, session, onLogout = () => {} }) {
  const supplierId = supplierIdProp ?? session?.customerId;
  const supplierName = nameProp ?? session?.customerName ?? "";

  const [allInvoices, setAllInvoices] = useState([]); // every shipment, for the trend + dropdown
  const [listLoading, setListLoading] = useState(Boolean(supplierId));
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [invoiceId, setInvoiceId] = useState("");
  const [detail, setDetail] = useState(null); // the selected invoice, fetched by invoice number
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [drilldown, setDrilldown] = useState(null);

  // 1) All shipments once per supplier: fills the dropdown and trend chart.
  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    setListLoading(true);
    setListError("");
    fetchInvoiceList(supplierId)
      .then((data) => {
        if (cancelled) return;
        setAllInvoices(data);
        const newest = [...data].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        setInvoiceId((prev) => (data.some((i) => i.id === prev) ? prev : newest?.id ?? ""));
      })
      .catch((e) => !cancelled && setListError(e.message || "Couldn't load your shipments."))
      .finally(() => !cancelled && setListLoading(false));
    return () => {
      cancelled = true;
    };
  }, [supplierId, reloadKey]);

  // 2) The selected invoice, looked up by its invoice number.
  useEffect(() => {
    if (!supplierId || !invoiceId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    fetchInvoice(supplierId, invoiceId)
      .then((data) => {
        if (cancelled) return;
        setDetail(Array.isArray(data) ? data[0] ?? null : data);
      })
      .catch((e) => !cancelled && setDetailError(e.message || "Couldn't load this invoice."))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [supplierId, invoiceId, reloadKey]);

  const invoicesNewestFirst = useMemo(
    () => [...allInvoices].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [allInvoices]
  );

  const lines = useMemo(() => {
    if (!detail) return [];
    return (detail.items ?? []).map((item) => ({ ...item, invoiceId: detail.id, invoiceDate: detail.date }));
  }, [detail]);

  const totals = useMemo(() => {
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
  }, [lines]);

  const chartData = useMemo(() => {
    const byProduct = new Map();
    for (const l of lines) {
      const entry = byProduct.get(l.product) ?? { product: l.product, shipped: 0, sold: 0, returned: 0, weightedDays: 0 };
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
  }, [lines]);

  const insights = useMemo(() => {
    const eligible = chartData.filter((d) => d.sold >= MIN_SOLD_FOR_INSIGHT);
    if (eligible.length === 0) return { fastest: null, slowest: null, highestReturn: null, lowestReturn: null };
    return {
      fastest: eligible.reduce((a, b) => (b.avgDays < a.avgDays ? b : a)),
      slowest: eligible.reduce((a, b) => (b.avgDays > a.avgDays ? b : a)),
      highestReturn: eligible.reduce((a, b) => (b.returnRate > a.returnRate ? b : a)),
      lowestReturn: eligible.reduce((a, b) => (b.returnRate < a.returnRate ? b : a)),
    };
  }, [chartData]);

  // Sales of THIS shipment for every calendar day since delivery, each day
  // tagged with what might explain it (nearby event, weekend, salary week).
  const timeline = useMemo(() => {
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
      .filter((p) => p.isHigh)
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
  }, [detail]);

  const drillMetric = drilldown ? DRILL_METRICS[drilldown.key] : null;
  const drilldownRanked = useMemo(() => {
    if (!drillMetric) return [];
    return [...chartData].sort((a, b) => a[drillMetric.field] - b[drillMetric.field]);
  }, [chartData, drillMetric]);

  // ---- load / error / empty states (all hooks are above this line) ----
  const retry = () => setReloadKey((k) => k + 1);
  const retryButton = (
    <button
      type="button"
      onClick={retry}
      className="mt-4 rounded-md border border-[#D8D2C2] bg-white px-3 py-1.5 text-sm font-medium text-[#1B2430] hover:border-[#D98E2B]"
    >
      Try again
    </button>
  );

  const header = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <img src="/gripstyle-logo.png" alt="Gripstyle" className="h-16 w-auto sm:h-20" />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[11px] font-medium text-[#8D8577]">Signed in as</p>
          <p className="text-sm font-medium text-[#1B2430]">{supplierName}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-[#D8D2C2] bg-white px-3 py-1.5 text-sm font-medium text-[#1B2430] transition-colors hover:border-[#C2543A] hover:text-[#C2543A] focus:outline-none focus:ring-2 focus:ring-[#D98E2B]"
        >
          Log out
        </button>
      </div>
    </div>
  );

  if (!supplierId) {
    return (
      <div>
        {header}
        <Notice tone="error">
          No supplier id was passed to ProductPerformance. Pass supplierId={"{session.customerId}"} or session={"{session}"}.
        </Notice>
      </div>
    );
  }
  if (listLoading) {
    return (
      <div>
        {header}
        <Notice>Loading your shipments…</Notice>
      </div>
    );
  }
  if (listError) {
    return (
      <div>
        {header}
        <Notice tone="error" action={retryButton}>{listError}</Notice>
      </div>
    );
  }
  if (allInvoices.length === 0) {
    return (
      <div>
        {header}
        <Notice>No shipments have been recorded for your account yet.</Notice>
      </div>
    );
  }

  const maxValue = Math.max(0, ...chartData.map((d) => d.sold));
  const { axisMax, ticks } = buildAxis(maxValue);
  // Small axis: a shipment sells a few units a day, so don't force a 20-unit minimum.
  const trendAxisMax = Math.max(4, Math.ceil(Math.max(0, ...(timeline?.points ?? []).map((p) => p.sold)) / 4) * 4);
  const trendTicks = [0, 1, 2, 3, 4].map((i) => (trendAxisMax / 4) * i);
  const drilldownAxis = drillMetric
    ? buildAxis(Math.max(0, ...drilldownRanked.map((d) => d[drillMetric.field])))
    : { axisMax: 0, ticks: [] };
  const selectedMeta = allInvoices.find((i) => i.id === invoiceId);

  function toggleDrilldown(key, product) {
    setDrilldown((prev) => (prev && prev.key === key ? null : { key, product }));
  }

  return (
    <div>
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium tracking-tight text-[#1B2430]">Product performance</h1>

        <label className="flex items-center gap-2 text-sm text-[#5B6472]">
          Select invoice
          <select
            value={invoiceId}
            onChange={(e) => {
              setInvoiceId(e.target.value);
              setDrilldown(null);
            }}
            className="rounded-md border border-[#D8D2C2] bg-white px-2.5 py-1.5 text-sm text-[#1B2430] focus:outline-none focus:ring-2 focus:ring-[#D98E2B]"
          >
            {invoicesNewestFirst.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.id} — {fmtDate(inv.date)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-2 text-sm text-[#5B6472]">
        {selectedMeta ? `Shipment ${selectedMeta.id}, delivered ${fmtDate(selectedMeta.date)}.` : ""}
      </p>

      {detailError && (
        <div className="mt-4">
          <Notice tone="error" action={retryButton}>{detailError}</Notice>
        </div>
      )}

      <div className={detailLoading ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"} aria-busy={detailLoading}>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Units shipped" value={totals.shipped} tone="#1B2430" />
          <Stat label="Units sold" value={totals.sold} tone={SOLD_COLOR} />
          <Stat label="Units returned" value={totals.returned} tone={RETURNED_COLOR} />
          <Stat label="Sell-through" value={`${totals.sellThrough.toFixed(0)}%`} tone={sellThroughTone(totals.sellThrough)} />
          <Stat label="Avg. days to sell" value={totals.avgDays.toFixed(0)} tone="#1B2430" />
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-medium text-[#1B2430]">
            At a glance <span className="font-normal text-[#8D8577]">(this invoice)</span>
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <InsightCard
              eyebrow="Fastest moving"
              product={insights.fastest?.product}
              metric={insights.fastest ? `${insights.fastest.avgDays.toFixed(0)}d to sell` : null}
              metricTone={SOLD_COLOR}
              detail={insights.fastest ? `${insights.fastest.sold} sold` : null}
              active={drilldown?.key === "fastest"}
              onClick={() => insights.fastest && toggleDrilldown("fastest", insights.fastest.product)}
            />
            <InsightCard
              eyebrow="Slowest moving"
              product={insights.slowest?.product}
              metric={insights.slowest ? `${insights.slowest.avgDays.toFixed(0)}d to sell` : null}
              metricTone="#B08900"
              detail={insights.slowest ? `${insights.slowest.sold} sold` : null}
              active={drilldown?.key === "slowest"}
              onClick={() => insights.slowest && toggleDrilldown("slowest", insights.slowest.product)}
            />
            <InsightCard
              eyebrow="Highest return rate"
              product={insights.highestReturn?.product}
              metric={insights.highestReturn ? `${insights.highestReturn.returnRate.toFixed(0)}%` : null}
              metricTone={RETURNED_COLOR}
              detail={insights.highestReturn ? `${insights.highestReturn.returned} of ${insights.highestReturn.sold} sold` : null}
              active={drilldown?.key === "highestReturn"}
              onClick={() => insights.highestReturn && toggleDrilldown("highestReturn", insights.highestReturn.product)}
            />
            <InsightCard
              eyebrow="Lowest return rate"
              product={insights.lowestReturn?.product}
              metric={insights.lowestReturn ? `${insights.lowestReturn.returnRate.toFixed(0)}%` : null}
              metricTone={SOLD_COLOR}
              detail={insights.lowestReturn ? `${insights.lowestReturn.returned} of ${insights.lowestReturn.sold} sold` : null}
              active={drilldown?.key === "lowestReturn"}
              onClick={() => insights.lowestReturn && toggleDrilldown("lowestReturn", insights.lowestReturn.product)}
            />
          </div>
          <p className="mt-2 text-xs text-[#8D8577]">
            Based on products with at least {MIN_SOLD_FOR_INSIGHT} units sold, so a single sale can't skew the ranking.
            Click a card to see it plotted against every other product.
          </p>

          {drilldown && drillMetric && (
            <div className="mt-4 rounded-lg border border-[#D8D2C2] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-[#1B2430]">
                    {drillMetric.label} — every product, {drilldown.product} highlighted
                  </h3>
                  <p className="mt-1 text-xs text-[#5B6472]">
                    Sorted lowest to highest {drillMetric.field === "avgDays" ? "days to sell" : "return rate"}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrilldown(null)}
                  className="rounded-md border border-[#D8D2C2] px-2 py-1 text-xs font-medium text-[#5B6472] hover:border-[#B0A98C]"
                >
                  Close
                </button>
              </div>

              {drilldownRanked.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#8D8577]">No data for this invoice.</p>
              ) : (
                <div className="mt-4 flex">
                  <div className="relative mt-6 h-48 w-10 shrink-0">
                    {drilldownAxis.ticks.map((t) => (
                      <span
                        key={t}
                        className="absolute right-2 translate-y-1/2 text-[11px] text-[#8D8577]"
                        style={{ bottom: `${(t / drilldownAxis.axisMax) * 100}%` }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1 overflow-x-auto pt-6">
                    <div style={{ minWidth: `${Math.max(480, drilldownRanked.length * 60)}px` }}>
                      <div className="relative h-48" role="img" aria-label={`Bar chart ranking every product by ${drillMetric.label}`}>
                        {drilldownAxis.ticks.map((t) => (
                          <div
                            key={t}
                            className="absolute inset-x-0 border-t border-[#E2D9C6]"
                            style={{ bottom: `${(t / drilldownAxis.axisMax) * 100}%` }}
                          />
                        ))}
                        <div className="absolute inset-0 flex items-end">
                          {drilldownRanked.map((d) => (
                            <RankBar
                              key={d.product}
                              label={d.product}
                              value={d[drillMetric.field]}
                              axisMax={drilldownAxis.axisMax}
                              isHighlighted={d.product === drilldown.product}
                              color={drillMetric.barColor}
                              unit={drillMetric.unit}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-[#D8D2C2] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-[#1B2430]">Sales trend for this shipment</h2>
            {timeline && (
              <span className="text-xs text-[#5B6472]">
                Delivered {timeline.ageDays === 0 ? "today" : `${timeline.ageDays} day${timeline.ageDays === 1 ? "" : "s"} ago`}
              </span>
            )}
          </div>

          {!timeline || !timeline.points.some((p) => p.sold > 0) ? (
            <p className="py-16 text-center text-sm text-[#8D8577]">No sales recorded for this shipment yet.</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-[#D8D2C2] bg-[#FBF9F4] px-4 py-3">
                  <p className="text-xs font-medium text-[#5B6472]">Best day</p>
                  {timeline.peak ? (
                    <>
                      <p className="mt-1 text-lg font-medium tracking-tight" style={{ color: HIGHLIGHT_COLOR }}>
                        {fmtDay(timeline.peak.date)}
                      </p>
                      <p className="mt-0.5 text-xs text-[#8D8577]">{timeline.peak.sold} units sold</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[#8D8577]">Sales were steady, no standout day.</p>
                  )}
                </div>
                <div className="rounded-lg border border-[#D8D2C2] bg-[#FBF9F4] px-4 py-3">
                  <p className="text-xs font-medium text-[#5B6472]">Around events</p>
                  {timeline.eventLift ? (
                    <>
                      <p
                        className="mt-1 text-lg font-medium tracking-tight"
                        style={{ color: timeline.eventLift.multiple >= 1.2 ? SOLD_COLOR : timeline.eventLift.multiple < 0.8 ? RETURNED_COLOR : "#1B2430" }}
                      >
                        ×{timeline.eventLift.multiple.toFixed(1)} sales
                      </p>
                      <p className="mt-0.5 text-xs text-[#8D8577]">
                        {timeline.eventLift.yesAvg.toFixed(1)}/day near {timeline.eventLift.names.join(", ")} vs{" "}
                        {timeline.eventLift.noAvg.toFixed(1)}/day otherwise
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[#8D8577]">No listed event fell in this shipment's selling period.</p>
                  )}
                </div>
                <div className="rounded-lg border border-[#D8D2C2] bg-[#FBF9F4] px-4 py-3">
                  <p className="text-xs font-medium text-[#5B6472]">Weekends</p>
                  {timeline.weekendLift ? (
                    <>
                      <p
                        className="mt-1 text-lg font-medium tracking-tight"
                        style={{ color: timeline.weekendLift.multiple >= 1.2 ? SOLD_COLOR : timeline.weekendLift.multiple < 0.8 ? RETURNED_COLOR : "#1B2430" }}
                      >
                        ×{timeline.weekendLift.multiple.toFixed(1)} sales
                      </p>
                      <p className="mt-0.5 text-xs text-[#8D8577]">
                        {timeline.weekendLift.yesAvg.toFixed(1)}/day on Sat–Sun vs {timeline.weekendLift.noAvg.toFixed(1)}/day on weekdays
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[#8D8577]">Not enough days yet to compare.</p>
                  )}
                </div>
                <div className="rounded-lg border border-[#D8D2C2] bg-[#FBF9F4] px-4 py-3">
                  <p className="text-xs font-medium text-[#5B6472]">Still unsold</p>
                  <p className="mt-1 text-lg font-medium tracking-tight" style={{ color: sellThroughTone(totals.sellThrough) }}>
                    {Math.max(0, totals.shipped - totals.sold)} units
                  </p>
                  <p className="mt-0.5 text-xs text-[#8D8577]">{(100 - totals.sellThrough).toFixed(0)}% of {totals.shipped} shipped</p>
                </div>
              </div>

              <h3 className="mt-6 text-sm font-medium text-[#1B2430]">Days sales were highest, and what was around them</h3>
              {timeline.topDays.length === 0 ? (
                <p className="mt-2 text-sm text-[#8D8577]">
                  No day stood out: sales were spread fairly evenly across this shipment.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[#F1EEE4] rounded-lg border border-[#D8D2C2]">
                  {timeline.topDays.map((p) => {
                    const r = p.reasons;
                    const none = r.events.length === 0 && !r.weekend && !r.payday;
                    return (
                      <li key={p.index} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                        <div className="w-32 shrink-0">
                          <p className="text-sm font-medium text-[#1B2430]">{fmtDay(p.date)}</p>
                          <p className="text-xs text-[#8D8577]">Day {p.index} after delivery</p>
                        </div>
                        <p className="w-20 shrink-0 text-sm font-medium" style={{ color: SOLD_COLOR }}>
                          {p.sold} units
                        </p>
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          {r.events.map((e) => (
                            <span key={e.name + e.diff} className="rounded-full bg-[#F7E7CF] px-2.5 py-0.5 text-[11px] font-medium text-[#8A5A1E]">
                              {describeEvent(e)}
                            </span>
                          ))}
                          {r.weekend && (
                            <span className="rounded-full bg-[#EAE3D2] px-2.5 py-0.5 text-[11px] font-medium text-[#5B6472]">Weekend</span>
                          )}
                          {r.payday && (
                            <span className="rounded-full bg-[#EAE3D2] px-2.5 py-0.5 text-[11px] font-medium text-[#5B6472]">Salary week (1st–7th)</span>
                          )}
                          {none && <span className="text-xs text-[#8D8577]">No known event, weekend or salary week</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-6 flex">
                <div className="relative mt-6 h-56 w-10 shrink-0">
                  {trendTicks.map((t) => (
                    <span
                      key={t}
                      className="absolute right-2 translate-y-1/2 text-[11px] text-[#8D8577]"
                      style={{ bottom: `${(t / trendAxisMax) * 100}%` }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex-1 overflow-x-auto pt-12">
                  <div style={{ minWidth: `${Math.max(480, timeline.points.length * 40)}px` }}>
                    <div className="relative h-56" role="img" aria-label="Bar chart of units sold from this shipment on each day">
                      {trendTicks.map((t) => (
                        <div
                          key={t}
                          className="absolute inset-x-0 border-t border-[#E2D9C6]"
                          style={{ bottom: `${(t / trendAxisMax) * 100}%` }}
                        />
                      ))}
                      <div className="absolute inset-0 flex items-end">
                        {timeline.points.map((p) => (
                          <DayBar key={p.index} point={p} axisMax={trendAxisMax} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#8D8577]">
                Units sold from this shipment each day. Orange bars are high days (at least twice the daily average);
                orange pills mark an event that day or near a high day; orange weekday names are weekends. Events count
                when they fall up to 3 days after, or 1 day before, a sale day. This shows what coincided with sales,
                not proof of cause, and with only a few units a day, treat small differences with caution.
              </p>
            </>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-[#D8D2C2] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-[#1B2430]">Sold and returned by product</h2>
            <div className="flex items-center gap-4 text-xs text-[#5B6472]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SOLD_COLOR }} />
                Sold
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: RETURNED_COLOR }} />
                Returned
              </span>
            </div>
          </div>

          {chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8D8577]">No data for this invoice.</p>
          ) : (
            <div className="mt-4 flex">
              <div className="relative mt-6 h-64 w-10 shrink-0">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute right-2 translate-y-1/2 text-[11px] text-[#8D8577]"
                    style={{ bottom: `${(t / axisMax) * 100}%` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex-1 overflow-x-auto pt-6">
                <div className="min-w-[480px]">
                  <div className="relative h-64" role="img" aria-label="Bar chart of units sold and returned, by product">
                    {ticks.map((t) => (
                      <div
                        key={t}
                        className="absolute inset-x-0 border-t border-[#E2D9C6]"
                        style={{ bottom: `${(t / axisMax) * 100}%` }}
                      />
                    ))}
                    <div className="absolute inset-0 flex items-end">
                      {chartData.map((d) => (
                        <Bar key={d.product} label={d.product} sold={d.sold} returned={d.returned} axisMax={axisMax} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-[#D8D2C2] bg-white p-5 sm:p-6">
          <h2 className="text-sm font-medium text-[#1B2430]">Invoice-wise breakdown</h2>
          <p className="mt-1 text-xs text-[#5B6472]">
            Sell-through is units sold ÷ units shipped for that line. Returned units are counted inside sold.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2D9C6] text-left text-xs font-medium text-[#5B6472]">
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Variant</th>
                  <th className="py-2 pr-3 text-right">MRP</th>
                  <th className="py-2 pr-3 text-right">Shipped</th>
                  <th className="py-2 pr-3 text-right">Sold</th>
                  <th className="py-2 pr-3 text-right">Returned</th>
                  <th className="py-2 pr-3 text-right">Sell-through</th>
                  <th className="py-2 text-right">Avg. days to sell</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const pct = l.shipped > 0 ? (l.sold / l.shipped) * 100 : 0;
                  return (
                    <tr key={`${l.invoiceId}-${l.id}`} className="border-b border-[#F1EEE4] last:border-0">
                      <td className="py-2 pr-3 text-[#5B6472]">{l.invoiceId}</td>
                      <td className="py-2 pr-3 font-medium text-[#1B2430]">{l.product}</td>
                      <td className="py-2 pr-3 text-[#5B6472]">{l.variant}</td>
                      <td className="py-2 pr-3 text-right text-[#1B2430]">{fmtMoney(l.mrp)}</td>
                      <td className="py-2 pr-3 text-right text-[#1B2430]">{l.shipped}</td>
                      <td className="py-2 pr-3 text-right" style={{ color: SOLD_COLOR }}>{l.sold}</td>
                      <td className="py-2 pr-3 text-right" style={{ color: RETURNED_COLOR }}>{l.returned}</td>
                      <td className="py-2 pr-3 text-right font-medium" style={{ color: sellThroughTone(pct) }}>
                        {pct.toFixed(0)}%
                      </td>
                      <td className="py-2 text-right text-[#1B2430]">{l.daysToSell}d</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#E2D9C6] text-sm font-medium">
                  <td className="py-2.5 pr-3 text-[#1B2430]" colSpan={4}>Total</td>
                  <td className="py-2.5 pr-3 text-right text-[#1B2430]">{totals.shipped}</td>
                  <td className="py-2.5 pr-3 text-right" style={{ color: SOLD_COLOR }}>{totals.sold}</td>
                  <td className="py-2.5 pr-3 text-right" style={{ color: RETURNED_COLOR }}>{totals.returned}</td>
                  <td className="py-2.5 pr-3 text-right" style={{ color: sellThroughTone(totals.sellThrough) }}>
                    {totals.sellThrough.toFixed(0)}%
                  </td>
                  <td className="py-2.5 text-right text-[#1B2430]">{totals.avgDays.toFixed(0)}d</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[#D8D2C2] bg-[#FBF9F4] px-4 py-3">
              <p className="text-xs font-medium text-[#5B6472]">Total sold value</p>
              <p className="mt-1 text-lg font-medium tracking-tight text-[#1B2430]">{fmtMoney(totals.soldValue)}</p>
              <p className="mt-0.5 text-xs text-[#8D8577]">{totals.sold} units at MRP</p>
            </div>
            <div className="rounded-lg border border-[#D8D2C2] bg-[#FBF9F4] px-4 py-3">
              <p className="text-xs font-medium text-[#5B6472]">Less: returned value</p>
              <p className="mt-1 text-lg font-medium tracking-tight" style={{ color: RETURNED_COLOR }}>
                − {fmtMoney(totals.returnedValue)}
              </p>
              <p className="mt-0.5 text-xs text-[#8D8577]">{totals.returned} units at MRP</p>
            </div>
            <div className="rounded-lg border border-[#2E6E62] bg-[#F1F7F5] px-4 py-3">
              <p className="text-xs font-medium text-[#5B6472]">Net money made</p>
              <p className="mt-1 text-lg font-medium tracking-tight" style={{ color: SOLD_COLOR }}>
                {fmtMoney(totals.netValue)}
              </p>
              <p className="mt-0.5 text-xs text-[#8D8577]">Sold value − returned value</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}