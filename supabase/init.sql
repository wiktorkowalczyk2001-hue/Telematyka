-- Create anon role if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_roles 
    WHERE rolname = 'anon'
  ) THEN 
    CREATE ROLE anon NOINHERIT; 
  END IF; 
END $$;

-- Grant permissions to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encryption key (should be changed in production via environment variable)
-- For now using a default. In production, pass via DEFERRABLE config
-- Usage: pgp_sym_encrypt(value, current_setting('app.encryption_key')::text)
-- Usage: pgp_sym_decrypt(encrypted_value, current_setting('app.encryption_key')::text)

-- Create encryption helper functions
CREATE OR REPLACE FUNCTION encrypt_field(text_value TEXT, encryption_key TEXT DEFAULT 'telemed-default-key')
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(text_value, encryption_key);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION decrypt_field(encrypted_value BYTEA, encryption_key TEXT DEFAULT 'telemed-default-key')
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_value, encryption_key);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create users table (doctors)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  specialization VARCHAR(150) NOT NULL,
  pwz_number VARCHAR(20) NOT NULL UNIQUE,
  nip VARCHAR(10) NOT NULL UNIQUE,
  clinic_name VARCHAR(200) NOT NULL,
  phone BYTEA,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_pwz ON users(pwz_number);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON users TO anon;

-- Policies for users table
DROP POLICY IF EXISTS "Allow insert registration" ON users;
DROP POLICY IF EXISTS "Allow read own profile" ON users;
DROP POLICY IF EXISTS "Allow update own profile" ON users;

CREATE POLICY "Allow insert registration" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read own profile" ON users FOR SELECT USING (true);
CREATE POLICY "Allow update own profile" ON users FOR UPDATE USING (true);

-- Create patients table (with encrypted fields)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  pesel BYTEA,
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 150),
  phone BYTEA,
  email BYTEA,
  address BYTEA,
  primary_diagnosis VARCHAR(255) NOT NULL,
  last_visit DATE NOT NULL,
  allergies TEXT,
  chronic_conditions TEXT,
  medical_history TEXT,
  medications TEXT,
  clinical_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on last_name for faster searches
CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Grant permissions on patients table to anon role
GRANT SELECT, INSERT, UPDATE, DELETE ON patients TO anon;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous read access" ON patients;
DROP POLICY IF EXISTS "Allow anonymous insert" ON patients;
DROP POLICY IF EXISTS "Allow anonymous update" ON patients;
DROP POLICY IF EXISTS "Allow anonymous delete" ON patients;
DROP POLICY IF EXISTS "Users can view own patients" ON patients;
DROP POLICY IF EXISTS "Users can create patients" ON patients;
DROP POLICY IF EXISTS "Users can update own patients" ON patients;
DROP POLICY IF EXISTS "Users can delete own patients" ON patients;

-- Permissive policies for now (will need proper auth integration later)
-- In production, replace with: USING (doctor_id = auth.uid())
CREATE POLICY "Allow read patients" ON patients
  FOR SELECT USING (true);

CREATE POLICY "Allow insert patients" ON patients
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update patients" ON patients
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete patients" ON patients
  FOR DELETE USING (true);

-- Create visits table
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  visit_time VARCHAR(5) NOT NULL,
  reason VARCHAR(255) NOT NULL DEFAULT 'Brak wpisu',
  soap_subjective TEXT,
  soap_objective TEXT,
  soap_assessment TEXT,
  soap_plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON visits TO anon;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all visits" ON visits;
DROP POLICY IF EXISTS "Users can view own visits" ON visits;
DROP POLICY IF EXISTS "Users can create visits" ON visits;
DROP POLICY IF EXISTS "Users can update own visits" ON visits;
DROP POLICY IF EXISTS "Users can delete own visits" ON visits;

-- Permissive policies for now
-- In production: USING (doctor_id = auth.uid())
CREATE POLICY "Allow read visits" ON visits FOR SELECT USING (true);
CREATE POLICY "Allow insert visits" ON visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update visits" ON visits FOR UPDATE USING (true);
CREATE POLICY "Allow delete visits" ON visits FOR DELETE USING (true);

-- Create medical_documents table (for multimedia: PDF, images, DICOM)
CREATE TABLE IF NOT EXISTS medical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('pdf', 'jpg', 'png', 'dicom', 'dcm', 'audio')),
  mime_type VARCHAR(100),
  storage_path VARCHAR(500) NOT NULL,
  file_size_bytes INTEGER,
  description TEXT,
  metadata JSONB,
  is_encrypted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_docs_patient ON medical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_doctor ON medical_documents(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_visit ON medical_documents(visit_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_type ON medical_documents(file_type);
CREATE INDEX IF NOT EXISTS idx_medical_docs_created ON medical_documents(created_at DESC);

ALTER TABLE medical_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON medical_documents TO anon;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all medical docs" ON medical_documents;
DROP POLICY IF EXISTS "Users can view own documents" ON medical_documents;
DROP POLICY IF EXISTS "Users can create documents" ON medical_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON medical_documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON medical_documents;

-- Permissive policies for now
-- In production: USING (doctor_id = auth.uid())
CREATE POLICY "Allow read documents" ON medical_documents FOR SELECT USING (true);
CREATE POLICY "Allow insert documents" ON medical_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update documents" ON medical_documents FOR UPDATE USING (true);
CREATE POLICY "Allow delete documents" ON medical_documents FOR DELETE USING (true);

-- Insert sample data - SIMPLIFIED (no encryption functions in INSERT)
-- First, insert doctors (users) - plaintext phone for init, encryption done at app level
INSERT INTO users (email, password_hash, first_name, last_name, specialization, pwz_number, nip, clinic_name, phone, status, approved_at)
VALUES 
  ('dr.kowalski@example.com', '$2b$12$hash1', 'Jan', 'Kowalski', 'Internista', 'PWZ/00001/2023', '1234567890', 'Klinika Pod Medykiem', NULL, 'approved', NOW()),
  ('dr.nowak@example.com', '$2b$12$hash2', 'Maria', 'Nowak', 'Pediatra', 'PWZ/00002/2023', '1234567891', 'Centrum Zdrowia Dziecka', NULL, 'pending', NULL),
  ('dr.wisniewski@example.com', '$2b$12$hash3', 'Piotr', 'Wiśniewski', 'Kardiolog', 'PWZ/00003/2023', '1234567892', 'Poradnia Kardiologiczna', NULL, 'approved', NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert sample patients (without encryption - will be handled at app level)
INSERT INTO patients (doctor_id, first_name, last_name, pesel, age, phone, email, address, primary_diagnosis, last_visit, allergies, chronic_conditions, medical_history, medications, clinical_notes)
VALUES
  ((SELECT id FROM users WHERE email = 'dr.kowalski@example.com' LIMIT 1), 'Jan', 'Kowalski', NULL, 45, NULL, NULL, NULL, 'Nadciśnienie tętnicze', '2026-04-20', 'Penicylina', 'Cukrzyca typu 2, Nadciśnienie', 'Rozpoznanie cukrzycy 5 lat temu', 'Lisinopryl', 'Wizyta kontrolna.'),
  ((SELECT id FROM users WHERE email = 'dr.nowak@example.com' LIMIT 1), 'Maria', 'Nowak', NULL, 32, NULL, NULL, NULL, 'Astma oskrzelowa', '2026-04-15', 'Orzeszki ziemne', 'Astma', 'Alergie sezonowe od dziecka', 'Salbutamol', 'Astma kontrolowana.'),
  ((SELECT id FROM users WHERE email = 'dr.wisniewski@example.com' LIMIT 1), 'Piotr', 'Wiśniewski', NULL, 58, NULL, NULL, NULL, 'Cukrzyca typu 2', '2026-04-10', 'Brak', 'Cukrzyca typu 2', 'Brak istotnej historii', 'Metformina', 'Cukry ustabilizowane.')
ON CONFLICT DO NOTHING;
