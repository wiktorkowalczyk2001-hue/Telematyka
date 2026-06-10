import { getCache, setCache, queuePendingOp, isNetworkError, clearCacheIfNeeded, prepareForOfflineCache } from './offlineCache';

const API_URL = 'http://192.168.0.31:3001';

const mapPatient = (p) => ({
  id: p.id,
  doctorId: p.doctor_id,
  firstName: p.first_name,
  lastName: p.last_name,
  pesel: p.pesel, // Backend zwraca już deszyfrowane
  age: p.age,
  phone: p.phone, // Backend zwraca już deszyfrowane
  email: p.email, // Backend zwraca już deszyfrowane
  address: p.address, // Backend zwraca już deszyfrowane
  diagnosis: p.primary_diagnosis,
  lastVisitDate: p.last_visit,
  allergies: p.allergies,
  chronicConditions: p.chronic_conditions,
  medicalHistory: p.medical_history,
  currentMedications: p.medications,
  notes: p.clinical_notes,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

const toDb = (d) => ({
  first_name: d.firstName,
  last_name: d.lastName,
  pesel: d.pesel,
  age: d.age || 0,
  phone: d.phone || '',
  email: d.email || '',
  address: d.address || '',
  primary_diagnosis: d.diagnosis || 'Brak wpisu',
  last_visit: d.lastVisitDate || new Date().toISOString().split('T')[0],
  allergies: d.allergies || '',
  chronic_conditions: d.chronicConditions || '',
  medical_history: d.medicalHistory || '',
  medications: d.currentMedications || '',
  clinical_notes: d.notes || '',
});

/**
 * Fetch all patients for current doctor
 * Filters: doctor_id=eq.DOCTOR_ID
 */
export const fetchAllPatients = async (doctorId) => {
  if (!doctorId) throw new Error('Doctor ID is required');
  
  try {
    // Filter by doctor_id to get only own patients
    const r = await fetch(
      `${API_URL}/patients?doctor_id=eq.${doctorId}&order=created_at.desc`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    
    // Prepare data for offline cache (ensure no excessive size)
    const preparedData = data.map(p => prepareForOfflineCache(p, 'patient'));
    
    // Store cache per-user (doctorId as key)
    await setCache(`patients_${doctorId}`, preparedData);
    
    return data.map(mapPatient);
  } catch (e) {
    if (isNetworkError(e)) {
      // Try to get cached data for this doctor
      const cached = await getCache(`patients_${doctorId}`);
      if (cached) return cached.map(mapPatient);
    }
    throw e;
  }
};

/**
 * Fetch single patient by ID
 * User can only access their own patients (filtered server-side)
 */
export const fetchPatientById = async (patientId, doctorId) => {
  if (!patientId) throw new Error('Patient ID is required');
  if (!doctorId) throw new Error('Doctor ID is required');
  
  try {
    // Query with doctor_id filter
    const r = await fetch(
      `${API_URL}/patients?id=eq.${patientId}&doctor_id=eq.${doctorId}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    
    if (!data.length) throw new Error('Patient not found or access denied');
    
    return mapPatient(data[0]);
  } catch (e) {
    if (isNetworkError(e)) {
      // Try cache
      const cached = await getCache(`patients_${doctorId}`);
      const found = cached?.find((p) => p.id === patientId);
      if (found) return mapPatient(found);
    }
    throw e;
  }
};

/**
 * Add patient (associated with current doctor)
 */
export const addPatient = async (patientData, doctorId) => {
  if (!patientData.firstName || !patientData.lastName || !patientData.pesel) {
    throw new Error('Imię, nazwisko i PESEL są wymagane');
  }
  if (!doctorId) throw new Error('Doctor ID is required');
  
  const body = {
    ...toDb(patientData),
    doctor_id: doctorId, // Assign to current doctor
  };
  
  try {
    const r = await fetch(`${API_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    const patient = data[0] || data;
    
    // Update cache for this doctor
    const cached = (await getCache(`patients_${doctorId}`)) || [];
    const preparedPatient = prepareForOfflineCache(patient, 'patient');
    await setCache(`patients_${doctorId}`, [...cached, preparedPatient]);
    
    return mapPatient(patient);
  } catch (e) {
    if (isNetworkError(e)) {
      await clearCacheIfNeeded();
      await queuePendingOp({
        _table: 'patients',
        method: 'POST',
        url: `${API_URL}/patients`,
        body: JSON.stringify(body),
      });
      const tempId = 'pending_' + Date.now();
      const tempRaw = { id: tempId, ...body, created_at: new Date().toISOString(), _pending: true };
      const cached = (await getCache(`patients_${doctorId}`)) || [];
      await setCache(`patients_${doctorId}`, [...cached, tempRaw]);
      return mapPatient(tempRaw);
    }
    throw e;
  }
};

/**
 * Update existing patient
 */
export const updatePatient = async (patientId, patientData, doctorId) => {
  if (!patientId) throw new Error('Patient ID is required');
  if (!doctorId) throw new Error('Doctor ID is required');
  
  const body = toDb(patientData);
  try {
    // Query with doctor_id filter for security
    const r = await fetch(
      `${API_URL}/patients?id=eq.${patientId}&doctor_id=eq.${doctorId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body),
      }
    );
    
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    const patient = data[0] || data;
    
    // Update cache
    const cached = (await getCache(`patients_${doctorId}`)) || [];
    await setCache(
      `patients_${doctorId}`,
      cached.map((p) => (p.id === patientId ? { ...p, ...body } : p))
    );
    
    return mapPatient(patient);
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({
        _table: 'patients',
        method: 'PATCH',
        url: `${API_URL}/patients?id=eq.${patientId}`,
        body: JSON.stringify(body),
      });
      
      const cached = (await getCache(`patients_${doctorId}`)) || [];
      await setCache(
        `patients_${doctorId}`,
        cached.map((p) => (p.id === patientId ? { ...p, ...body, _pending: true } : p))
      );
      
      const updated = cached.find((p) => p.id === patientId);
      return mapPatient({ ...(updated || {}), ...body, id: patientId });
    }
    throw e;
  }
};

/**
 * Delete patient
 */
export const deletePatient = async (patientId, doctorId) => {
  if (!patientId) throw new Error('Patient ID is required');
  if (!doctorId) throw new Error('Doctor ID is required');
  
  try {
    // Query with doctor_id filter for security
    const r = await fetch(
      `${API_URL}/patients?id=eq.${patientId}&doctor_id=eq.${doctorId}`,
      { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!r.ok) throw new Error('Server error');
    
    // Update cache
    const cached = (await getCache(`patients_${doctorId}`)) || [];
    await setCache(
      `patients_${doctorId}`,
      cached.filter((p) => p.id !== patientId)
    );
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({
        _table: 'patients',
        method: 'DELETE',
        url: `${API_URL}/patients?id=eq.${patientId}`,
        body: null,
      });
      
      const cached = (await getCache(`patients_${doctorId}`)) || [];
      await setCache(
        `patients_${doctorId}`,
        cached.filter((p) => p.id !== patientId)
      );
      return;
    }
    throw e;
  }
};

export const searchPatients = async (searchTerm, doctorId) => {
  if (!searchTerm?.trim()) return fetchAllPatients(doctorId);
  if (!doctorId) throw new Error('Doctor ID is required');
  
  try {
    const term = `%${searchTerm}%`;
    // Filter by doctor_id AND search criteria
    const r = await fetch(
      `${API_URL}/patients?and=(doctor_id.eq.${doctorId},or=(first_name.ilike.${term},last_name.ilike.${term}))&order=created_at.desc`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!r.ok) throw new Error('Server error');
    return (await r.json()).map(mapPatient);
  } catch (e) {
    if (isNetworkError(e)) {
      const cacheKey = `patients_${doctorId}`;
      const cached = await getCache(cacheKey);
      if (cached) {
        const q = searchTerm.toLowerCase();
        return cached
          .filter((p) => p.first_name?.toLowerCase().includes(q) || p.last_name?.toLowerCase().includes(q))
          .map(mapPatient);
      }
    }
    throw e;
  }
};

export const updateClinicalNotes = async (patientId, notes) => {
  if (!patientId) throw new Error('Patient ID is required');
  try {
    const r = await fetch(`${API_URL}/patients?id=eq.${patientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinical_notes: notes }),
    });
    if (!r.ok) throw new Error('Server error');
    return r.json();
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({ url: `${API_URL}/patients?id=eq.${patientId}`, method: 'PATCH', body: JSON.stringify({ clinical_notes: notes }) });
      const cached = (await getCache('patients')) || [];
      await setCache('patients', cached.map((p) => (p.id === patientId ? { ...p, clinical_notes: notes } : p)));
      return;
    }
    throw e;
  }
};
