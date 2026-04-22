/**
 * SQL Migration Script for Patients Table
 * 
 * Execute this SQL in Supabase SQL Editor to create the patients table
 * 
 * Steps:
 * 1. Go to your Supabase project dashboard
 * 2. Click "SQL Editor" on the left sidebar
 * 3. Click "New Query"
 * 4. Paste the SQL below
 * 5. Click "Run"
 */

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 150),
  primary_diagnosis VARCHAR(255) NOT NULL,
  last_visit DATE NOT NULL,
  medical_history TEXT,
  medications TEXT,
  clinical_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on last_name for faster searches
CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

-- Enable Row Level Security (optional but recommended for security)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read all patients (optional)
CREATE POLICY "Allow anonymous read access" ON patients
  FOR SELECT USING (true);

-- Optional: Allow authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated insert" ON patients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON patients
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON patients
  FOR DELETE USING (auth.role() = 'authenticated');

-- Insert sample data (optional, for testing)
INSERT INTO patients (first_name, last_name, age, primary_diagnosis, last_visit, medical_history, medications, clinical_notes)
VALUES
  ('Jan', 'Kowalski', 45, 'Nadciśnienie tętnicze', '2026-04-20', 'Cukrzyca typu 2, Nadciśnienie', 'Lisinopryl', 'Wizyta kontrolna.'),
  ('Maria', 'Nowak', 32, 'Astma oskrzelowa', '2026-04-15', 'Alergie sezonowe', 'Salbutamol', 'Astma kontrolowana.'),
  ('Piotr', 'Wiśniewski', 58, 'Cukrzyca typu 2', '2026-04-10', 'Brak', 'Metformina', 'Cukry ustabilizowane.');
