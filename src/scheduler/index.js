import cron from "node-cron";
import { DateTime } from "luxon";
import { listBusinesses, getLeadsNeedingFollowUp, updateLead } from "../db/queries.js";
import { sendMessage } from "../integrations/whatsapp.js";
import { runWeeklyPulseForBusiness } from "./weekly.js";

const sentWeekKeys = new Set();

function weekKey(businessId, tz) {
  const local = DateTime.now().setZone(tz);
  return `${businessId}:${local.weekYear}-W${local.weekNumber}`;
}

export { runWeeklyPulseForBusiness } from "./weekly.js";

async function weeklyPulseTick() {
  const businesses = await listBusinesses();
  for (const b of businesses) {
    const tz = b.timezone || "Africa/Nairobi";
    const key = weekKey(b.id, tz);
    if (sentWeekKeys.has(key)) continue;
    try {
      await runWeeklyPulseForBusiness(b.id);
      sentWeekKeys.add(key);
    } catch (e) {
      console.error("weeklyPulse", b.id, e);
    }
  }
}

async function followUpTick() {
  const businesses = await listBusinesses();
  for (const b of businesses) {
    const tz = b.timezone || "Africa/Nairobi";
    try {
      const leads = await getLeadsNeedingFollowUp(b.id);
      for (const lead of leads) {
        const name = lead.customer_name ?? "there";
        const msg = `Hi ${name}, just checking in — are you still planning your move? We have slots available this week.`;
        await sendMessage(String(lead.phone).replace(/\D/g, ""), msg);
        const nextCount = (lead.follow_up_count ?? 0) + 1;
        const nextFollow = DateTime.now().setZone(tz).plus({ days: 3 }).toISO();
        const archived = nextCount >= 2;
        await updateLead(lead.id, {
          follow_up_count: nextCount,
          follow_up_at: nextFollow,
          status: archived ? "archived" : lead.status,
        });
      }
    } catch (e) {
      console.error("followUp", b.id, e);
    }
  }
}

export function startScheduler() {
  const tz = "Africa/Nairobi";
  cron.schedule("0 18 * * 0", weeklyPulseTick, { timezone: tz });
  cron.schedule("0 10 * * *", followUpTick, { timezone: tz });
  console.log("Scheduler started (weekly Sun 18:00, follow-up daily 10:00, TZ " + tz + ").");
}
