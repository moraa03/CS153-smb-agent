import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("SUPABASE_URL or SUPABASE_ANON_KEY missing — DB calls will fail until set.");
}

export const supabase = createClient(url ?? "", key ?? "");
