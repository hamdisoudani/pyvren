-- 006_security_audit_models_and_rls.sql
-- 1. Model failover chain columns (Fallback Model 1 & Fallback Model 2) on site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS fallback_model_1 TEXT,
  ADD COLUMN IF NOT EXISTS fallback_model_2 TEXT;

-- 2. Persistent Security & Login Audit Logs (IP, country, user-agent, outcome)
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  country TEXT,
  user_agent TEXT,
  email TEXT,
  path TEXT,
  method TEXT,
  status_code INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at
  ON security_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ip
  ON security_audit_logs (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type
  ON security_audit_logs (event_type, created_at DESC);

-- 3. Persistent IP Blocklist (auto-populated on repeated rate-limit/captcha/auth abuse + manual admin bans)
CREATE TABLE IF NOT EXISTS ip_blocks (
  ip_address TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_blocks_until
  ON ip_blocks (blocked_until DESC);

-- 4. Enable & FORCE Row Level Security across EVERY table in public schema
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE category_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_skills FORCE ROW LEVEL SECURITY;

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE ip_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_blocks FORCE ROW LEVEL SECURITY;

-- 5. Strictly revoke ALL write privileges from anon & authenticated on EVERY table,
--    and revoke ALL read privileges on private/internal tables.
REVOKE ALL ON TABLE admin_users FROM anon, authenticated;
REVOKE ALL ON TABLE site_settings FROM anon, authenticated;
REVOKE ALL ON TABLE agent_runs FROM anon, authenticated;
REVOKE ALL ON TABLE security_audit_logs FROM anon, authenticated;
REVOKE ALL ON TABLE ip_blocks FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE posts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE category_skills FROM anon, authenticated;

-- Drop any accidental permissive write policies if they ever existed
DROP POLICY IF EXISTS allow_anon_write_posts ON posts;
DROP POLICY IF EXISTS allow_anon_write_settings ON site_settings;
DROP POLICY IF EXISTS allow_anon_write_admin ON admin_users;
DROP POLICY IF EXISTS allow_anon_write_skills ON category_skills;

-- 6. Hard database-level rule: permanently forbid inserting any new admin user once owner exists
CREATE OR REPLACE FUNCTION prevent_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.admin_users) >= 1 THEN
    RAISE EXCEPTION 'Registration is permanently disabled: no new admin users may be added.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_new_admin_user ON public.admin_users;
CREATE TRIGGER trg_prevent_new_admin_user
  BEFORE INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_new_admin_user();

-- Also forbid deleting the sole locked admin row
CREATE OR REPLACE FUNCTION prevent_delete_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Owner account cannot be deleted.'
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_delete_admin_user ON public.admin_users;
CREATE TRIGGER trg_prevent_delete_admin_user
  BEFORE DELETE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_admin_user();
