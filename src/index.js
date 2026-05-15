import "dotenv/config";
import express from "express";
import whatsappRouter from "./routes/whatsapp.js";
import mpesaRouter from "./routes/mpesa.js";
import demoRouter from "./routes/demo.js";
import { startScheduler } from "./scheduler/index.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(whatsappRouter);
app.use("/mpesa", mpesaRouter);
app.use("/demo", demoRouter);

app.listen(port, () => {
  console.log(`smb-agent listening on http://localhost:${port}`);
  startScheduler();
});
