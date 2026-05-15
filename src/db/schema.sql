-- smb-agent MVP schema (run in Supabase SQL editor)
-- RLS disabled for class demo; re-enable with real auth for production.

CREATE TYPE lead_status AS ENUM (
  'new',
  'quote_sent',
  'warm',
  'confirmed',
  'completed',
  'archived'
);

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  whatsapp_phone_number_id TEXT,
  owner_phone TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  from_location TEXT,
  to_location TEXT,
  move_date DATE,
  quoted_price NUMERIC(12, 2),
  status lead_status NOT NULL DEFAULT 'new',
  follow_up_at TIMESTAMPTZ,
  follow_up_count INT NOT NULL DEFAULT 0,
  deposit_paid BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX leads_business_phone_idx ON leads (business_id, phone);
CREATE INDEX leads_business_status_followup_idx ON leads (business_id, status, follow_up_at);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads (id) ON DELETE SET NULL,
  revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expenses NUMERIC(12, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  route_from TEXT,
  route_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX jobs_business_date_idx ON jobs (business_id, date);

CREATE TABLE staff_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  crew_member TEXT NOT NULL,
  job_id UUID REFERENCES jobs (id) ON DELETE SET NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  on_time BOOLEAN,
  complaints TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_logs DISABLE ROW LEVEL SECURITY;
