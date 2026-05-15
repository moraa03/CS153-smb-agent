import { Router } from "express";
import { runWeeklyPulseForBusiness } from "../scheduler/weekly.js";

const router = Router();

router.post("/trigger-weekly-pulse", async (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    return res.status(404).end();
  }
  const businessId = req.body?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ error: "businessId required" });
  try {
    const out = await runWeeklyPulseForBusiness(businessId);
    return res.json({ ok: true, text: out.text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message ?? e) });
  }
});

export default router;
