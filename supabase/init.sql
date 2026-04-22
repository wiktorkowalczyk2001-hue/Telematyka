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

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  pesel VARCHAR(11),
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 150),
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
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

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Grant permissions on patients table to anon role
GRANT SELECT, INSERT, UPDATE, DELETE ON patients TO anon;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous read access" ON patients;
DROP POLICY IF EXISTS "Allow anonymous insert" ON patients;
DROP POLICY IF EXISTS "Allow anonymous update" ON patients;
DROP POLICY IF EXISTS "Allow anonymous delete" ON patients;

-- Allow anyone to read all patients
CREATE POLICY "Allow anonymous read access" ON patients
  FOR SELECT USING (true);

-- Allow anyone to insert patients
CREATE POLICY "Allow anonymous insert" ON patients
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update patients
CREATE POLICY "Allow anonymous update" ON patients
  FOR UPDATE USING (true);

-- Allow anyone to delete patients
CREATE POLICY "Allow anonymous delete" ON patients
  FOR DELETE USING (true);

-- Insert sample data
INSERT INTO patients (first_name, last_name, pesel, age, phone, email, address, primary_diagnosis, last_visit, allergies, chronic_conditions, medical_history, medications, clinical_notes)
VALUES 
  ('Jan', 'Kowalski', '81042012345', 45, '123-456-789', 'jan.kowalski@example.com', 'Warszawa, ul. Testowa 1', 'Nadciśnienie tętnicze', '2026-04-20', 'Penicylina', 'Cukrzyca typu 2, Nadciśnienie', 'Rozpoznanie cukrzycy 5 lat temu', 'Lisinopryl', 'Wizyta kontrolna.'),
  ('Maria', 'Nowak', '94051512345', 32, '987-654-321', 'maria.nowak@example.com', 'Kraków, ul. Przykładowa 2', 'Astma oskrzelowa', '2026-04-15', 'Orzeszki ziemne', 'Astma', 'Alergie sezonowe od dziecka', 'Salbutamol', 'Astma kontrolowana.'),
  ('Piotr', 'Wiśniewski', '68041012345', 58, '111-222-333', 'piotr.w@example.com', 'Poznań, ul. Główna 3', 'Cukrzyca typu 2', '2026-04-10', 'Brak', 'Cukrzyca typu 2', 'Brak istotnej historii', 'Metformina', 'Cukry ustabilizowane.');
