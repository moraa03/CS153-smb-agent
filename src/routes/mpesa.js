import { Router } from "express";
import { sendMessage } from "../integrations/whatsapp.js";
import { supabase } from "../db/client.js";
import * as queries from "../db/queries.js";

const router = Router();

function parseMetadataItems(items) {
  const map = {};
  for (const it of items ?? []) {
    if (it?.Name && it?.Value !== undefined) map[it.Name] = it.Value;
  }
  return map;
}

function normalizeKenyaPhone(phoneRaw) {
  let d = String(phoneRaw ?? "").replace(/\D/g, "");
  if (d.startsWith("254")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return `+254${d}`;
}

router.post("/callback", async (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback;
    const items = parseMetadataItems(cb?.CallbackMetadata?.Item);
    const amount = items.Amount;
    const phoneRaw = items.PhoneNumber;
    const txDate = items.TransactionDate;
    const receipt = items.MpesaReceiptNumber;
    const phone = normalizeKenyaPhone(phoneRaw);

    const { data: businesses, error: bErr } = await supabase.from("businesses").select("*").limit(50);
    if (bErr) throw bErr;

    let matchedLead = null;
    let business = null;
    for (const b of businesses ?? []) {
      const lead = await queries.findLeadForDeposit(b.id, phone);
      if (lead) {
        matchedLead = lead;
        business = b;
        break;
      }
    }

    if (matchedLead && business) {
      await queries.updateLead(matchedLead.id, {
        status: "confirmed",
        deposit_paid: true,
        notes: [matchedLead.notes, `M-Pesa ${receipt} ${txDate} KES ${amount}`].filter(Boolean).join(" | "),
      });

      const route = `${matchedLead.from_location ?? "?"} → ${matchedLead.to_location ?? "?"}`;
      const dateStr = matchedLead.move_date ?? "your scheduled date";
      const custTo = String(matchedLead.phone).replace(/\D/g, "");
      const ownerTo = String(business.owner_phone).replace(/\D/g, "");

      await sendMessage(
        custTo,
        `✅ Deposit received! Your move on ${dateStr} is confirmed. We'll be in touch 24h before. Thank you!`
      );
      await sendMessage(
        ownerTo,
        `💰 Deposit received from ${matchedLead.customer_name} for ${route} on ${dateStr}. Amount: KES ${amount}`
      );
    }

    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (e) {
    console.error("mpesa callback", e);
    return res.status(500).json({ error: "callback failed" });
  }
});

export default router;
