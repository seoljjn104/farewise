# Supabase Setup for FareWise

This guide explains how to set up Supabase for the FareWise application and deploy to Vercel.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project's **URL** and **anon/public** key from the Settings → API section
3. The anon key is labeled as `public` or `anon` key

## 2. Database Tables

Run the following SQL in your Supabase SQL editor to create the required tables:

```sql
-- farewise_state: Stores the full app state for synchronization
CREATE TABLE IF NOT EXISTS farewise_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- fare_matrices: Vehicle fare classes (already seeded with default data)
CREATE TABLE IF NOT EXISTS fare_matrices (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(10),
  mode VARCHAR(50),
  base_fare INTEGER DEFAULT 14,
  base_km INTEGER DEFAULT 4,
  per_km NUMERIC DEFAULT 2,
  discount_pct INTEGER DEFAULT 20,
  effective_from DATE DEFAULT '2026-11-01',
  source TEXT,
  active BOOLEAN DEFAULT true
);

-- trip_ledger: Logged trips
CREATE TABLE IF NOT EXISTS trip_ledger (
  id VARCHAR(100) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  from_id VARCHAR(50),
  to_id VARCHAR(50),
  from_name TEXT,
  to_name TEXT,
  mode_id VARCHAR(50),
  mode_name VARCHAR(50),
  role_id VARCHAR(20),
  role_label VARCHAR(20),
  distance_km NUMERIC DEFAULT 0,
  distance_source VARCHAR(20),
  fare NUMERIC DEFAULT 0,
  gross NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  leg_count INTEGER DEFAULT 1
);

-- advisories: Route advisories/moderation
CREATE TABLE IF NOT EXISTS advisories (
  id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  title TEXT,
  body TEXT,
  category VARCHAR(50),
  severity VARCHAR(20),
  area TEXT,
  author TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  confirms INTEGER DEFAULT 0
);

-- admin_users: Admin account roster
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'admin',
  mfa_enrolled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- audit_log: Audit trail
CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(50) PRIMARY KEY,
  at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  action VARCHAR(50),
  entity VARCHAR(50),
  entity_id VARCHAR(50),
  before JSONB,
  after JSONB
);
```

## 3. Row Level Security (RLS)

**Important**: Disable RLS on all tables for the demo, or set up appropriate policies. The store.js code reads/writes directly via the REST API.

```sql
-- Disable RLS for all tables (demo mode)
ALTER TABLE farewise_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE fare_matrices DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE advisories DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
```

## 4. Seed Initial Data

Insert the default fare matrices:

```sql
INSERT INTO fare_matrices (id, code, mode, base_fare, base_km, per_km, discount_pct, effective_from, source, active) VALUES
  ('puj-traditional', 'PUJ', 'Traditional Jeepney', 14, 4, 2, 20, '2026-11-01', 'LTFRB / DOTr provisional fare matrix, effective 28 Nov 2026', true),
  ('puj-modern', 'MPUJ', 'Modern Jeepney (MPUJ)', 17, 4, 2.4, 20, '2026-11-01', 'LTFRB / DOTr provisional fare matrix, effective 28 Nov 2026', true),
  ('bus-ordinary', 'BUS-O', 'Provincial Bus — Ordinary', 15, 5, 1.9, 20, '2026-11-01', 'LTFRB provincial bus fare matrix, effective 28 Nov 2026', true),
  ('bus-aircon', 'BUS-A', 'Provincial Bus — Air-conditioned', 15, 5, 2.64, 20, '2026-11-01', 'LTFRB provincial bus fare matrix, effective 28 Nov 2026', true);
```

## 5. Environment Variables

Add these to your Vercel project Settings → Environment Variables:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://your-project-ref.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key-here` |
| `VITE_ADMIN_DEMO` | `1` |
| `VITE_ADMIN_DEMO_PASSWORD` | `farewise-demo` |

## 6. Vercel Deployment

The `vercel.json` is already configured. Deploy using:

```bash
vercel
# or connect your GitHub repo to Vercel for automatic deployments
```

The app will start with localStorage (offline-capable), and once the Supabase env vars are set, it will synchronize state with Supabase.

## 7. Testing the Integration

After deployment, verify:

- **Without Supabase vars**: App works with localStorage, all 106 tests pass
- **With Supabase vars**: State is loaded from Supabase on initial load, and committed to Supabase on each change
- **Fallback**: If Supabase is unavailable, the app falls back to localStorage without errors