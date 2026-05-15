import { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { supabase, businessId } from "./lib/supabase.js";

const TZ = "Africa/Nairobi";
const PIPELINE = ["new", "quote_sent", "warm", "confirmed", "completed", "archived"];

function weekRangeIso() {
  const start = DateTime.now().setZone(TZ).startOf("week");
  const end = DateTime.now().setZone(TZ).endOf("week");
  return { start: start.toISODate(), end: end.toISODate() };
}

function nextStatus(current) {
  const i = PIPELINE.indexOf(current);
  if (i < 0 || current === "archived") return current;
  if (i >= PIPELINE.length - 1) return current;
  return PIPELINE[i + 1];
}

function formatMoney(n, currency = "KES") {
  const v = Number(n) || 0;
  return `${currency} ${v.toLocaleString()}`;
}

export default function App() {
  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [business, setBusiness] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessId) {
      setErr("Set VITE_BUSINESS_ID in client/.env (run npm run seed and copy the printed id).");
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const [{ data: b }, { data: l }, { data: j }, { data: s }] = await Promise.all([
        supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
        supabase.from("leads").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
        supabase.from("jobs").select("*").eq("business_id", businessId).order("date", { ascending: false }),
        supabase.from("staff_logs").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20),
      ]);
      setBusiness(b);
      setLeads(l ?? []);
      setJobs(j ?? []);
      setStaff(s ?? []);
    } catch (e) {
      setErr(String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { start: wStart, end: wEnd } = weekRangeIso();
  const weekJobs = useMemo(() => {
    return (jobs ?? []).filter((j) => j.date >= wStart && j.date <= wEnd);
  }, [jobs, wStart, wEnd]);

  const totals = useMemo(() => {
    let revenue = 0;
    let expenses = 0;
    let profit = 0;
    for (const j of weekJobs) {
      revenue += Number(j.revenue);
      expenses += Number(j.expenses);
      profit += Number(j.profit);
    }
    return { revenue, expenses, profit, count: weekJobs.length };
  }, [weekJobs]);

  const currency = business?.currency ?? "KES";

  const leadsByStatus = useMemo(() => {
    const m = {};
    for (const s of PIPELINE) m[s] = [];
    for (const lead of leads) {
      const k = PIPELINE.includes(lead.status) ? lead.status : "new";
      m[k].push(lead);
    }
    return m;
  }, [leads]);

  async function advanceLead(lead) {
    const ns = nextStatus(lead.status);
    if (ns === lead.status) return;
    const { error } = await supabase.from("leads").update({ status: ns }).eq("id", lead.id);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--color-text-muted)] tracking-[0.16em] text-[length:var(--text-eyebrow)] uppercase">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ fontFamily: "var(--font-body)" }}>
      <header className="border-b border-[var(--color-divider)]">
        <div className="mx-auto max-w-[var(--spacing-content)] px-6 py-8">
          <p className="text-[length:var(--text-eyebrow)] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {DateTime.now().setZone(TZ).toFormat("cccc · d MMM")}
          </p>
          <h1 className="mt-2 max-w-3xl text-[length:var(--text-headline)] font-normal leading-none tracking-[-0.025em] text-[var(--color-text-base)]" style={{ fontFamily: "var(--font-display)" }}>
            {business?.name ?? "Your business"}
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--color-text-secondary)]">Pipeline, jobs, and crew — this week in {TZ.replace("_", " ")}.</p>
        </div>
      </header>

      <main className="mx-auto max-w-[var(--spacing-content)] space-y-14 px-6 py-10">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {err}
          </div>
        )}

        <section>
          <h2 className="text-[length:var(--text-eyebrow)] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">This week</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Jobs", value: totals.count },
              { label: "Revenue", value: formatMoney(totals.revenue, currency) },
              { label: "Expenses", value: formatMoney(totals.expenses, currency) },
              { label: "Profit", value: formatMoney(totals.profit, currency) },
            ].map((card) => (
              <div key={card.label} className="border-b border-[var(--color-divider)] pb-4">
                <p className="text-[length:var(--text-eyebrow)] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{card.label}</p>
                <p
                  className="mt-2 text-[length:var(--text-stat)] font-light tracking-[-0.03em] text-[var(--color-text-base)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[length:var(--text-eyebrow)] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Lead pipeline</h2>
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
            {PIPELINE.filter((s) => s !== "archived").map((status) => (
              <div key={status} className="min-w-[220px] flex-1">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  {status.replace("_", " ")} ({leadsByStatus[status]?.length ?? 0})
                </p>
                <ul className="space-y-3">
                  {leadsByStatus[status]?.map((lead) => (
                    <li key={lead.id} className="rounded-lg border border-[var(--color-divider)] bg-[var(--color-surface)] p-3 shadow-sm">
                      <p className="text-[length:var(--text-list-title)] font-medium text-[var(--color-text-base)]">{lead.customer_name}</p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{lead.phone}</p>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        {(lead.from_location || "?") + " → " + (lead.to_location || "?")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {lead.move_date ?? "—"} · {lead.quoted_price != null ? formatMoney(lead.quoted_price, currency) : "—"}
                      </p>
                      {nextStatus(lead.status) !== lead.status && (
                        <button
                          type="button"
                          className="mt-3 w-full rounded-full bg-[var(--color-accent)] py-2 text-sm font-medium text-white hover:opacity-90"
                          onClick={() => advanceLead(lead)}
                        >
                          Move to {nextStatus(lead.status).replace("_", " ")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="min-w-[200px] flex-1">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">archived ({leadsByStatus.archived?.length ?? 0})</p>
              <ul className="space-y-3">
                {leadsByStatus.archived?.map((lead) => (
                  <li key={lead.id} className="rounded-lg border border-[var(--color-divider)] p-3 opacity-80">
                    <p className="font-medium">{lead.customer_name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{lead.phone}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[length:var(--text-eyebrow)] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Job ledger</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-divider)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--color-divider)] bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Route</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Revenue</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Expenses</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide">Profit</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-[var(--color-divider)] last:border-0">
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{j.date}</td>
                    <td className="px-4 py-3">
                      {(j.route_from || "?") + " → " + (j.route_to || "?")}
                    </td>
                    <td className="px-4 py-3">{formatMoney(j.revenue, currency)}</td>
                    <td className="px-4 py-3">{formatMoney(j.expenses, currency)}</td>
                    <td className="px-4 py-3 font-medium">{formatMoney(j.profit, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--color-bg)] font-medium">
                  <td className="px-4 py-3" colSpan={2}>
                    Running total ({jobs.length} jobs)
                  </td>
                  <td className="px-4 py-3">{formatMoney(jobs.reduce((a, j) => a + Number(j.revenue), 0), currency)}</td>
                  <td className="px-4 py-3">{formatMoney(jobs.reduce((a, j) => a + Number(j.expenses), 0), currency)}</td>
                  <td className="px-4 py-3">{formatMoney(jobs.reduce((a, j) => a + Number(j.profit), 0), currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[length:var(--text-eyebrow)] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Staff log</h2>
          <ul className="mt-4 divide-y divide-[var(--color-divider)] rounded-lg border border-[var(--color-divider)]">
            {staff.length === 0 && <li className="px-4 py-6 text-[var(--color-text-muted)]">No crew entries yet.</li>}
            {staff.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4">
                <div>
                  <p className="font-medium text-[var(--color-text-base)]">{row.crew_member}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Job {row.job_id ? String(row.job_id).slice(0, 8) + "…" : "—"}
                  </p>
                </div>
                <div className="text-right text-sm text-[var(--color-text-secondary)]">
                  <span className="font-medium">Rating {row.rating ?? "—"}</span>
                  {row.on_time != null && <span className="ml-3">{row.on_time ? "On time" : "Late"}</span>}
                  {row.complaints && <p className="mt-1 text-[var(--color-text-muted)]">{row.complaints}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
