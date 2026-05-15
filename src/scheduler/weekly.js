import { getWeeklySummary } from "../db/queries.js";
import { sendMessage } from "../integrations/whatsapp.js";

export async function runWeeklyPulseForBusiness(businessId) {
  const summary = await getWeeklySummary(businessId);
  const c = summary.currency ?? "KES";
  const best = summary.bestRoute ?? "N/A";
  const text = `📊 Weekly summary: ${summary.jobCount} jobs. Revenue: ${c}${summary.totalRevenue.toLocaleString()}. Expenses: ${c}${summary.totalExpenses.toLocaleString()}. Profit: ${c}${summary.totalProfit.toLocaleString()}. Best job: ${best}.`;
  const owner = summary.business?.owner_phone;
  if (owner) await sendMessage(String(owner).replace(/\D/g, ""), text);
  return { summary, text };
}
