import { useEffect, useRef, useState } from "react";
import {
  SOLD_COLOR,
  RETURNED_COLOR,
  HIGHLIGHT_COLOR,
  withBarcode,
  fmtShort,
  describeEvent,
  EXPORT_KINDS,
} from "./performanceUtils";

/* Small presentational components used by SupplierPerformance. */

export function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-[#D8D2C2] bg-white px-4 py-3.5">
      <p className="text-xs font-medium text-[#5B6472]">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

export function InsightCard({ eyebrow, product, barcode, metric, metricTone, detail, onClick, active }) {
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
      <p className="mt-1 truncate text-sm font-medium text-[#1B2430]" title={withBarcode(product, barcode)}>
        {product}
      </p>
      {barcode && <p className="truncate text-[11px] text-[#8D8577]">Barcode: {barcode}</p>}
      <p className="mt-1 text-xl font-medium tracking-tight" style={{ color: metricTone }}>
        {metric}
      </p>
      {detail && <p className="mt-0.5 text-xs text-[#8D8577]">{detail}</p>}
    </button>
  );
}

export function Bar({ label, barcode, sold, returned, axisMax }) {
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
      <p className="mt-2 max-w-[70px] truncate text-center text-[11px] text-[#5B6472]" title={withBarcode(label, barcode)}>
        {label}
      </p>
    </div>
  );
}

export function DayBar({ point, axisMax }) {
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

export function RankBar({ label, barcode, value, axisMax, isHighlighted, color, unit }) {
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
        title={withBarcode(label, barcode)}
      >
        {label}
      </p>
    </div>
  );
}

export function Notice({ tone = "muted", children, action }) {
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

// "Download Excel" button with two choices.
// onExport(kind) should return a promise; kind is one of EXPORT_KINDS.
export function ExportMenu({ onExport, disabled }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function choose(kind) {
    setOpen(false);
    setBusy(true);
    setError("");
    try {
      await onExport(kind);
    } catch (e) {
      setError(e?.message || "Couldn't create the Excel file.");
    } finally {
      setBusy(false);
    }
  }

  const options = [
    { kind: EXPORT_KINDS.BREAKDOWN, title: "Invoice breakdown only", text: "One sheet with the invoice-wise table and totals." },
    { kind: EXPORT_KINDS.BREAKDOWN_AND_TRENDS, title: "Breakdown + sales trend", text: "Two sheets: the breakdown and the day-by-day trend." },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md border border-[#D8D2C2] bg-white px-3 py-1.5 text-sm font-medium text-[#1B2430] transition-colors hover:border-[#2E6E62] focus:outline-none focus:ring-2 focus:ring-[#D98E2B] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Preparing file…" : "Download Excel ▾"}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-[#D8D2C2] bg-white p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.kind}
              type="button"
              role="menuitem"
              onClick={() => choose(o.kind)}
              className="block w-full rounded-md px-3 py-2 text-left hover:bg-[#F1F7F5] focus:bg-[#F1F7F5] focus:outline-none"
            >
              <span className="block text-sm font-medium text-[#1B2430]">{o.title}</span>
              <span className="block text-xs text-[#8D8577]">{o.text}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="absolute right-0 mt-1 w-64 text-right text-xs text-[#C2543A]">{error}</p>}
    </div>
  );
}
