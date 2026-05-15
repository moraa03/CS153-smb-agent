import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY) in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const ownerPhone = process.env.SEED_OWNER_PHONE || "+254700000000";
  const waPhone = process.env.SEED_WHATSAPP_BUSINESS_PHONE || "+254711000000";
  const waPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "demo-phone-number-id";

  const { data: biz, error: bErr } = await supabase
    .from("businesses")
    .insert({
      name: "Haraka Movers",
      whatsapp_number: waPhone,
      whatsapp_phone_number_id: waPhoneNumberId,
      owner_phone: ownerPhone,
      currency: "KES",
      timezone: "Africa/Nairobi",
    })
    .select()
    .single();
  if (bErr) throw bErr;
  const businessId = biz.id;
  console.log("Seeded business id:", businessId);

  const weekStart = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);

  const jobs = [
    {
      business_id: businessId,
      revenue: 18000,
      expenses: 9000,
      profit: 9000,
      date: iso(weekStart),
      route_from: "Kilimani",
      route_to: "Westlands",
    },
    {
      business_id: businessId,
      revenue: 24000,
      expenses: 14000,
      profit: 10000,
      date: iso(weekStart),
      route_from: "Karen",
      route_to: "Runda",
    },
    {
      business_id: businessId,
      revenue: 12000,
      expenses: 7000,
      profit: 5000,
      date: iso(weekStart),
      route_from: "Lavington",
      route_to: "Kileleshwa",
    },
  ];
  const { data: insertedJobs, error: jErr } = await supabase.from("jobs").insert(jobs).select();
  if (jErr) throw jErr;

  const leads = [
    {
      business_id: businessId,
      customer_name: "James M.",
      phone: "+254722111222",
      from_location: "Kilimani",
      to_location: "Kileleshwa",
      move_date: iso(new Date(weekStart.getTime() + 86400000)),
      quoted_price: 18000,
      status: "quote_sent",
      follow_up_at: new Date(Date.now() - 86400000).toISOString(),
      follow_up_count: 0,
    },
    {
      business_id: businessId,
      customer_name: "Mary K.",
      phone: "+254733444555",
      from_location: "Westlands",
      to_location: "Parklands",
      move_date: iso(new Date(weekStart.getTime() + 2 * 86400000)),
      quoted_price: 22000,
      status: "quote_sent",
      follow_up_at: new Date(Date.now() - 86400000).toISOString(),
      follow_up_count: 0,
    },
    {
      business_id: businessId,
      customer_name: "Peter K.",
      phone: "+254744666777",
      from_location: "Kilimani",
      to_location: "Karen",
      move_date: iso(new Date(weekStart.getTime() + 3 * 86400000)),
      quoted_price: 8000,
      status: "confirmed",
      deposit_paid: true,
      follow_up_count: 0,
    },
  ];
  const { data: insertedLeads, error: lErr } = await supabase.from("leads").insert(leads).select();
  if (lErr) throw lErr;

  const staff = [
    {
      business_id: businessId,
      crew_member: "Juma",
      job_id: insertedJobs[0]?.id ?? null,
      rating: 5,
      on_time: true,
      complaints: null,
    },
    {
      business_id: businessId,
      crew_member: "Kevo",
      job_id: insertedJobs[1]?.id ?? null,
      rating: 4,
      on_time: true,
      complaints: "Late 15m",
    },
  ];
  const { error: sErr } = await supabase.from("staff_logs").insert(staff);
  if (sErr) throw sErr;

  console.log("Seed complete. Set VITE_BUSINESS_ID in client/.env to:");
  console.log(businessId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
