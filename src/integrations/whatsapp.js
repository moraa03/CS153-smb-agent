import axios from "axios";

const BASE = "https://graph.facebook.com/v18.0";

export async function sendMessage(to, text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    console.error("sendMessage: missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN");
    return { ok: false, error: "missing_config" };
  }
  const url = `${BASE}/${phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: String(to).replace(/\D/g, ""),
    type: "text",
    text: { body: text },
  };
  try {
    const res = await axios.post(url, body, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      timeout: 20000,
    });
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("sendMessage error", e.response?.data ?? e.message);
    return { ok: false, error: e.message };
  }
}
