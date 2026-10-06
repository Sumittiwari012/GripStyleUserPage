import { useEffect, useMemo, useState } from "react";
import {
  SOLD_COLOR,
  RETURNED_COLOR,
  HIGHLIGHT_COLOR,
  MIN_SOLD_FOR_INSIGHT,
  DRILL_METRICS,
  fetchInvoiceList,
  fetchInvoice,
  fmtDate,
  fmtMoney,
  fmtDay,
  describeEvent,
  buildAxis,
  sellThroughTone,
  computeTotals,
  buildChartData,
  buildInsights,
  buildTimeline,
  exportToExcel,
} from "./performanceUtils";
import { Stat, InsightCard, Bar, DayBar, RankBar, Notice, ExportMenu } from "./PerformanceParts";

// supplierId: pass session.customerId (same value as the supplier id).
// Either pass supplierId/supplierName directly, or pass the login `session`
// ({ customerId, customerName }) and they are read from it.
export default function ProductPerformance({ supplierId: supplierIdProp, supplierName: nameProp, session, onLogout = () => {} }) {
  const supplierId = supplierIdProp ?? session?.customerId;
  const supplierName = nameProp ?? session?.customerName ?? "";

  const [allInvoices, setAllInvoices] = useState([]); // every shipment, for the dropdown
  const [listLoading, setListLoading] = useState(Boolean(supplierId));
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [invoiceId, setInvoiceId] = useState("");
  const [detail, setDetail] = useState(null); // the selected invoice, fetched by invoice number
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [drilldown, setDrilldown] = useState(null);

  // 1) All shipments once per supplier: fills the dropdown.
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

  const totals = useMemo(() => computeTotals(lines), [lines]);
  const chartData = useMemo(() => buildChartData(lines), [lines]);
  const insights = useMemo(() => buildInsights(chartData), [chartData]);
  const timeline = useMemo(() => buildTimeline(detail), [detail]);

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

  // Products with nothing sold are left out of the sold/returned chart.
  const soldChartData = chartData.filter((d) => d.sold > 0);
  // Days with no sales are left out of the daily trend chart.
  const trendPoints = (timeline?.points ?? []).filter((p) => p.sold > 0);
  const maxValue = Math.max(0, ...soldChartData.map((d) => d.sold));
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

  const handleExport = (kind) =>
    exportToExcel(kind, {
      invoiceId: detail.id,
      invoiceDate: detail.date,
      lines,
      totals,
      timeline,
    });

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
              barcode={insights.fastest?.barcode}
              metric={insights.fastest ? `${insights.fastest.avgDays.toFixed(0)}d to sell` : null}
              metricTone={SOLD_COLOR}
              detail={insights.fastest ? `${insights.fastest.sold} sold` : null}
              active={drilldown?.key === "fastest"}
              onClick={() => insights.fastest && toggleDrilldown("fastest", insights.fastest.product)}
            />
            <InsightCard
              eyebrow="Slowest moving"
              product={insights.slowest?.product}
              barcode={insights.slowest?.barcode}
              metric={insights.slowest ? `${insights.slowest.avgDays.toFixed(0)}d to sell` : null}
              metricTone="#B08900"
              detail={insights.slowest ? `${insights.slowest.sold} sold` : null}
              active={drilldown?.key === "slowest"}
              onClick={() => insights.slowest && toggleDrilldown("slowest", insights.slowest.product)}
            />
            <InsightCard
              eyebrow="Highest return rate"
              product={insights.highestReturn?.product}
              barcode={insights.highestReturn?.barcode}
              metric={insights.highestReturn ? `${insights.highestReturn.returnRate.toFixed(0)}%` : null}
              metricTone={RETURNED_COLOR}
              detail={insights.highestReturn ? `${insights.highestReturn.returned} of ${insights.highestReturn.sold} sold` : null}
              active={drilldown?.key === "highestReturn"}
              onClick={() => insights.highestReturn && toggleDrilldown("highestReturn", insights.highestReturn.product)}
            />
            <InsightCard
              eyebrow="Lowest return rate"
              product={insights.lowestReturn?.product}
              barcode={insights.lowestReturn?.barcode}
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
                              barcode={d.barcode}
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
            <h2 className="text-sm font-medium text-[#1B2430]">Sales trend for this invoice</h2>
            {timeline && (
              <span className="text-xs text-[#5B6472]">
                Delivered {timeline.ageDays === 0 ? "today" : `${timeline.ageDays} day${timeline.ageDays === 1 ? "" : "s"} ago`}
              </span>
            )}
          </div>

          {!timeline || !timeline.points.some((p) => p.sold > 0) ? (
            <p className="py-16 text-center text-sm text-[#8D8577]">No sales recorded for this invoice yet.</p>
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
                  <div style={{ minWidth: `${Math.max(480, trendPoints.length * 40)}px` }}>
                    <div className="relative h-56" role="img" aria-label="Bar chart of units sold from this shipment on each day">
                      {trendTicks.map((t) => (
                        <div
                          key={t}
                          className="absolute inset-x-0 border-t border-[#E2D9C6]"
                          style={{ bottom: `${(t / trendAxisMax) * 100}%` }}
                        />
                      ))}
                      <div className="absolute inset-0 flex items-end">
                        {trendPoints.map((p) => (
                          <DayBar key={p.index} point={p} axisMax={trendAxisMax} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#8D8577]">
                Units sold from this invoice each day. Orange bars are high days (at least twice the daily average);
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

          {soldChartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#8D8577]">No units sold on this invoice yet.</p>
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
                      {soldChartData.map((d) => (
                        <Bar key={d.product} label={d.product} barcode={d.barcode} sold={d.sold} returned={d.returned} axisMax={axisMax} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-[#D8D2C2] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-[#1B2430]">Invoice-wise breakdown</h2>
              
            </div>
            <ExportMenu onExport={handleExport} disabled={!detail || detailLoading || lines.length === 0} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2D9C6] text-left text-xs font-medium text-[#5B6472]">
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Barcode</th>
                  <th className="py-2 pr-3">Variant</th>
                  <th className="py-2 pr-3 text-right">MRP</th>
                  <th className="py-2 pr-3 text-right">Quantity</th>
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
                      <td className="py-2 pr-3 font-mono text-xs text-[#5B6472]">{l.barcode || "—"}</td>
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
                  <td className="py-2.5 pr-3 text-[#1B2430]" colSpan={5}>Total</td>
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