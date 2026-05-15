import { DateTime } from "luxon";
import { supabase } from "./client.js";

const TZ = "Africa/Nairobi";

function normalizeWaPhone(raw) {
  if (!raw) return "";
  let s = String(raw).replace(/\s/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  return s.replace(/[^\d]/g, "");
}

export function formatKenyaE164(raw) {
  const d = normalizeWaPhone(raw);
  if (!d) return raw == null ? "" : String(raw);
  if (d.startsWith("254")) return `+${d}`;
  if (d.length >= 9) return `+254${d.replace(/^0+/, "")}`;
  return `+${d}`;
}

function weekBoundsForBusiness(businessId, timezone = TZ) {
  const now = DateTime.now().setZone(timezone);
  const start = now.startOf("week");
  const end = now.endOf("week");
  return { start: start.toISODate(), end: end.toISODate(), now };
}

export async function createLead(businessId, data) {
  const phone = formatKenyaE164(data.phone);
  const row = {
    business_id: businessId,
    customer_name: data.customer_name,
    phone,
    from_location: data.from_location ?? null,
    to_location: data.to_location ?? null,
    move_date: data.move_date ?? null,
    quoted_price: data.quoted_price ?? null,
    status: data.status ?? "new",
    follow_up_at: data.follow_up_at ?? null,
    notes: data.notes ?? null,
  };
  const { data: inserted, error } = await supabase.from("leads").insert(row).select().single();
  if (error) throw error;
  return inserted;
}

export async function updateLead(leadId, data) {
  const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const { data: updated, error } = await supabase.from("leads").update(patch).eq("id", leadId).select().single();
  if (error) throw error;
  return updated;
}

export async function getLeadByPhone(businessId, phone) {
  const target = normalizeWaPhone(formatKenyaE164(phone));
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).find((l) => normalizeWaPhone(l.phone) === target) ?? null;
}

export async function createJob(data) {
  const row = {
    business_id: data.business_id,
    lead_id: data.lead_id ?? null,
    revenue: data.revenue ?? 0,
    expenses: data.expenses ?? 0,
    profit: data.profit ?? (Number(data.revenue ?? 0) - Number(data.expenses ?? 0)),
    date: data.date,
    route_from: data.route_from ?? null,
    route_to: data.route_to ?? null,
    notes: data.notes ?? null,
  };
  const { data: inserted, error } = await supabase.from("jobs").insert(row).select().single();
  if (error) throw error;
  return inserted;
}

export async function getWeeklySummary(businessId) {
  const { data: biz, error: bErr } = await supabase.from("businesses").select("*").eq("id", businessId).single();
  if (bErr) throw bErr;
  const tz = biz?.timezone ?? TZ;
  const { start, end } = weekBoundsForBusiness(businessId, tz);

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("business_id", businessId)
    .gte("date", start)
    .lte("date", end);
  if (error) throw error;

  const list = jobs ?? [];
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalProfit = 0;
  let best = null;
  for (const j of list) {
    totalRevenue += Number(j.revenue);
    totalExpenses += Number(j.expenses);
    totalProfit += Number(j.profit);
    if (!best || Number(j.profit) > Number(best.profit)) best = j;
  }
  const bestRoute =
    best && (best.route_from || best.route_to)
      ? `${best.route_from ?? "?"} → ${best.route_to ?? "?"}`
      : "N/A";

  return {
    business: biz,
    weekStart: start,
    weekEnd: end,
    jobCount: list.length,
    totalRevenue,
    totalExpenses,
    totalProfit,
    bestJob: best,
    bestRoute,
    currency: biz?.currency ?? "KES",
  };
}

export async function getStaleLead(businessId) {
  const rows = await getLeadsNeedingFollowUp(businessId);
  return rows[0] ?? null;
}

export async function getLeadsNeedingFollowUp(businessId) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "quote_sent")
    .lt("follow_up_count", 2)
    .not("follow_up_at", "is", null)
    .lte("follow_up_at", nowIso);
  if (error) throw error;
  return data ?? [];
}

export async function listBusinesses() {
  const { data, error } = await supabase.from("businesses").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getBusinessByDisplayPhone(displayPhone) {
  const normalized = normalizeWaPhone(displayPhone);
  const { data, error } = await supabase.from("businesses").select("*");
  if (error) throw error;
  const match = (data ?? []).find((b) => normalizeWaPhone(b.whatsapp_number) === normalized);
  return match ?? null;
}

export async function getBusinessByPhoneNumberId(phoneNumberId) {
  if (!phoneNumberId) return null;
  const { data, error } = await supabase.from("businesses").select("*").eq("whatsapp_phone_number_id", phoneNumberId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findLeadForDeposit(businessId, phone) {
  const target = normalizeWaPhone(phone);
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("business_id", businessId)
    .in("status", ["quote_sent", "confirmed"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).filter((l) => normalizeWaPhone(l.phone) === target);
  const open = rows.find((l) => l.status === "quote_sent" || (l.status === "confirmed" && !l.deposit_paid));
  return open ?? rows[0] ?? null;
}

export async function listRecentLeads(businessId, limit = 8) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, customer_name, phone, status, from_location, to_location, move_date, quoted_price, notes")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
