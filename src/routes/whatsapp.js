import { Router } from "express";
import { processMessage } from "../agent/index.js";
import { sendMessage } from "../integrations/whatsapp.js";
import { getBusinessByDisplayPhone, getBusinessByPhoneNumberId, listBusinesses } from "../db/queries.js";

const router = Router();

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge ?? "");
  }
  return res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg || msg.type !== "text") return;

    const senderPhone = msg.from;
    const messageText = msg.text?.body ?? "";
    const phoneNumberId = value?.metadata?.phone_number_id;
    const displayPhone = value?.metadata?.display_phone_number;

    let business =
      (await getBusinessByPhoneNumberId(phoneNumberId)) || (await getBusinessByDisplayPhone(displayPhone));
    if (!business && phoneNumberId && phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) {
      const all = await listBusinesses();
      business = all[0] ?? null;
    }
    if (!business) {
      console.warn("No business for webhook", { phoneNumberId, displayPhone });
      return;
    }

    let replyText;
    try {
      const out = await processMessage(business.id, senderPhone, messageText);
      replyText = out.replyText;
    } catch (e) {
      console.error("processMessage failed", e);
      replyText = "Something went wrong, please try again in a moment.";
    }
    await sendMessage(senderPhone, replyText);
  } catch (e) {
    console.error("POST /webhook error", e);
  }
});

export default router;
