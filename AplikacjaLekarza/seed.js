const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'postgres',
  port: 5432,
});

async function run() {
  await client.connect();
  
  // Insert Doctor
  const doctorRes = await client.query(`
    INSERT INTO users (email, password_hash, first_name, last_name, specialization, pwz_number, nip, clinic_name, status, approved_at)
    VALUES ('lekarz@telemed.pl', '$2b$12$somehash', 'Adam', 'Lekarz', 'Lekarz Rodzinny', 'PWZ/88888/2026', '8887776665', 'Przychodnia Rodzinna', 'approved', NOW())
    RETURNING id;
  `);
  const doctorId = doctorRes.rows[0].id;
  
  // Insert Patients
  await client.query(`
    INSERT INTO patients (doctor_id, first_name, last_name, age, primary_diagnosis, last_visit, allergies, chronic_conditions, medical_history, medications, clinical_notes)
    VALUES 
      ($1, 'Andrzej', 'Nowicki', 52, 'Nadciśnienie', '2026-05-15', 'Brak', 'Nadciśnienie tętnicze', 'Rozpoznanie 3 lata temu', 'Ramipril 5mg', 'Ciśnienie ustabilizowane'),
      ($1, 'Magdalena', 'Wójcik', 34, 'Zapalenie oskrzeli', '2026-06-05', 'Penicylina', 'Astma', 'Częste infekcje dróg oddechowych', 'Salbutamol, Amoksycylina', 'Zalecana kontrola za 7 dni'),
      ($1, 'Janusz', 'Polak', 68, 'Cukrzyca typu 2', '2026-05-28', 'Brak', 'Cukrzyca', 'Dieta cukrzycowa od 10 lat', 'Metformina 850mg', 'Poziom cukru w normie');
  `, [doctorId]);

  console.log("Dane dodane!");
  await client.end();
}

run().catch(console.error);
