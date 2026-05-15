import axios from "axios";

function darajaBase() {
  const env = process.env.MPESA_ENV === "production" ? "production" : "sandbox";
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export async function getMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("MPESA_CONSUMER_KEY/MPESA_CONSUMER_SECRET missing");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const url = `${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Basic ${auth}` },
    timeout: 20000,
  });
  return data.access_token;
}

export async function initiateSTKPush(_payload) {
  return Promise.reject(new Error("initiateSTKPush not implemented — stub for Daraja STK later"));
}
