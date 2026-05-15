import Anthropic from "@anthropic-ai/sdk";
import {
  createLead,
  updateLead,
  createJob,
  getWeeklySummary,
  listRecentLeads,
} from "../db/queries.js";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM = `You are an AI business assistant for a small service business.
A customer or owner is messaging you via WhatsApp.
Classify their intent and call the right tool.
If a customer asks for a price quote without a date, ask for the date before quoting.
If they confirm they want to book, request a deposit to lock in the slot.
If the owner sends a job summary (revenue + expenses), log it as a completed job.
Always reply in a friendly, concise, professional tone.
Reply in the same language the customer uses.

When updating a lead or scheduling follow-up, use lead_id from the recent leads context when possible.`;

const tools = [
  {
    name: "create_lead",
    description: "Create a new moving lead / customer inquiry.",
    input_schema: {
      type: "object",
      properties: {
        customer_name: { type: "string" },
        phone: { type: "string" },
        from_location: { type: "string" },
        to_location: { type: "string" },
        move_date: { type: "string", description: "ISO date YYYY-MM-DD if known" },
        quoted_price: { type: "number" },
      },
      required: ["customer_name", "phone"],
    },
  },
  {
    name: "update_lead_status",
    description: "Update lead status and optional notes.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        status: {
          type: "string",
          enum: ["new", "quote_sent", "warm", "confirmed", "completed", "archived"],
        },
        notes: { type: "string" },
      },
      required: ["lead_id", "status"],
    },
  },
  {
    name: "log_job",
    description: "Log a completed job with financials and route.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        revenue: { type: "number" },
        expenses: { type: "number" },
        route_from: { type: "string" },
        route_to: { type: "string" },
        date: { type: "string", description: "ISO date YYYY-MM-DD" },
      },
      required: ["revenue", "expenses", "date"],
    },
  },
  {
    name: "get_weekly_summary",
    description: "Get this week's job and P&L summary for the business.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "schedule_followup",
    description: "Schedule a follow-up for a lead.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        follow_up_date: { type: "string", description: "ISO datetime or YYYY-MM-DD" },
      },
      required: ["lead_id", "follow_up_date"],
    },
  },
];

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function runTool(businessId, senderPhone, name, input) {
  switch (name) {
    case "create_lead": {
      const phone = input.phone || senderPhone;
      const lead = await createLead(businessId, {
        customer_name: input.customer_name,
        phone,
        from_location: input.from_location,
        to_location: input.to_location,
        move_date: input.move_date ?? null,
        quoted_price: input.quoted_price ?? null,
      });
      return { ok: true, lead };
    }
    case "update_lead_status": {
      const lead = await updateLead(input.lead_id, {
        status: input.status,
        notes: input.notes ?? undefined,
      });
      return { ok: true, lead };
    }
    case "log_job": {
      const revenue = Number(input.revenue);
      const expenses = Number(input.expenses);
      const profit = revenue - expenses;
      const job = await createJob({
        business_id: businessId,
        lead_id: input.lead_id ?? null,
        revenue,
        expenses,
        profit,
        date: input.date,
        route_from: input.route_from,
        route_to: input.route_to,
      });
      if (input.lead_id) {
        await updateLead(input.lead_id, { status: "completed" }).catch(() => {});
      }
      return { ok: true, job };
    }
    case "get_weekly_summary": {
      const summary = await getWeeklySummary(businessId);
      return { ok: true, summary };
    }
    case "schedule_followup": {
      let iso = input.follow_up_date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso = `${iso}T09:00:00.000Z`;
      const lead = await updateLead(input.lead_id, { follow_up_at: iso });
      return { ok: true, lead };
    }
    default:
      return { ok: false, error: "unknown_tool" };
  }
}

function extractTextFromMessage(msg) {
  const parts = msg?.content ?? [];
  let text = "";
  for (const b of parts) {
    if (b.type === "text") text += b.text;
  }
  return text.trim();
}

export async function processMessage(businessId, senderPhone, messageText) {
  const recent = await listRecentLeads(businessId);
  const context = `BusinessId: ${businessId}\nSender phone: ${senderPhone}\nRecent leads (JSON): ${JSON.stringify(recent)}\n\nUser message:\n${messageText}`;

  const toolResults = [];
  let messages = [{ role: "user", content: context }];

  for (let i = 0; i < 6; i++) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      tools,
      messages,
    });

    const assistantBlocks = res.content;
    const toolUses = assistantBlocks.filter((b) => b.type === "tool_use");

    if (toolUses.length === 0) {
      const replyText = extractTextFromMessage({ content: assistantBlocks }) || "Thanks — I've noted that.";
      return { replyText, toolResults };
    }

    messages = [...messages, { role: "assistant", content: assistantBlocks }];
    const results = [];
    for (const tu of toolUses) {
      let output;
      try {
        output = await runTool(businessId, senderPhone, tu.name, tu.input);
      } catch (e) {
        output = { ok: false, error: String(e.message ?? e) };
      }
      toolResults.push({ name: tu.name, input: tu.input, output });
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(output),
      });
    }
    messages = [...messages, { role: "user", content: results }];
  }

  return { replyText: "I ran several steps — please check your dashboard for the latest.", toolResults };
}
