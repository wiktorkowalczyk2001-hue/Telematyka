-- Users table for doctor registration / approval system
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  specialization VARCHAR(100),
  pwz_number VARCHAR(50),
  nip VARCHAR(15),
  clinic_name VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  role VARCHAR(20) NOT NULL DEFAULT 'doctor' CHECK (role IN ('doctor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Allow PostgREST anonymous role full access (adjust to your setup)
GRANT ALL ON users TO anon;
GRANT ALL ON users TO authenticated;

-- Disable RLS for MVP (enable and add policies in production)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Seed: initial admin user (password: admin123 — change immediately)
INSERT INTO users (email, password_hash, first_name, last_name, status, role)
VALUES ('admin@telemed.pl', 'admin123', 'Admin', 'System', 'approved', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Seed: test doctor account
INSERT INTO users (email, password_hash, first_name, last_name, specialization, status)
VALUES ('lekarz@telemed.pl', 'password123', 'Jan', 'Kowalski', 'Kardiologia', 'approved')
ON CONFLICT (email) DO NOTHING;
