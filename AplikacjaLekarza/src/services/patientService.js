import { getCache, setCache, queuePendingOp, isNetworkError } from './offlineCache';

const API_URL = typeof window !== 'undefined' ? '/api' : 'http://192.168.0.31:3001';

const mapPatient = (p) => ({
  id: p.id,
  firstName: p.first_name,
  lastName: p.last_name,
  pesel: p.pesel,
  age: p.age,
  phone: p.phone,
  email: p.email,
  address: p.address,
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

export const fetchAllPatients = async () => {
  try {
    const r = await fetch(`${API_URL}/patients?order=created_at.desc`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    await setCache('patients', data);
    return data.map(mapPatient);
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache('patients');
      if (cached) return cached.map(mapPatient);
    }
    throw e;
  }
};

export const fetchPatientById = async (patientId) => {
  if (!patientId) throw new Error('Patient ID is required');
  try {
    const r = await fetch(`${API_URL}/patients?id=eq.${patientId}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    if (!data.length) throw new Error('Patient not found');
    return mapPatient(data[0]);
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache('patients');
      const found = cached?.find((p) => p.id === patientId);
      if (found) return mapPatient(found);
    }
    throw e;
  }
};

export const addPatient = async (patientData) => {
  if (!patientData.firstName || !patientData.lastName || !patientData.pesel) {
    throw new Error('Imię, nazwisko i PESEL są wymagane');
  }
  const body = toDb(patientData);
  try {
    const r = await fetch(`${API_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    const patient = data[0] ?? data;
    return mapPatient(patient);
  } catch (e) {
    if (isNetworkError(e)) {
      const tempId = 'pending_' + Date.now();
      await queuePendingOp({ url: `${API_URL}/patients`, method: 'POST', body: JSON.stringify(body), tempId });
      const tempRaw = { id: tempId, ...body, created_at: new Date().toISOString(), _pending: true };
      const cached = (await getCache('patients')) || [];
      await setCache('patients', [...cached, tempRaw]);
      return mapPatient(tempRaw);
    }
    throw e;
  }
};

export const updatePatient = async (patientId, patientData) => {
  if (!patientId) throw new Error('Patient ID is required');
  const body = toDb(patientData);
  try {
    const r = await fetch(`${API_URL}/patients?id=eq.${patientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    const patient = data[0] || data;
    const cached = (await getCache('patients')) || [];
    await setCache('patients', cached.map((p) => (p.id === patientId ? { ...p, ...body } : p)));
    return mapPatient(patient);
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({ url: `${API_URL}/patients?id=eq.${patientId}`, method: 'PATCH', body: JSON.stringify(body) });
      const cached = (await getCache('patients')) || [];
      await setCache('patients', cached.map((p) => (p.id === patientId ? { ...p, ...body, _pending: true } : p)));
      const updated = cached.find((p) => p.id === patientId);
      return mapPatient({ ...(updated || {}), ...body, id: patientId });
    }
    throw e;
  }
};

export const deletePatient = async (patientId) => {
  if (!patientId) throw new Error('Patient ID is required');
  try {
    const r = await fetch(`${API_URL}/patients?id=eq.${patientId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r.ok) throw new Error('Server error');
    const cached = (await getCache('patients')) || [];
    await setCache('patients', cached.filter((p) => p.id !== patientId));
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({ url: `${API_URL}/patients?id=eq.${patientId}`, method: 'DELETE', body: null });
      const cached = (await getCache('patients')) || [];
      await setCache('patients', cached.filter((p) => p.id !== patientId));
      return;
    }
    throw e;
  }
};

export const searchPatients = async (searchTerm) => {
  if (!searchTerm?.trim()) return fetchAllPatients();
  try {
    const term = `%${searchTerm}%`;
    const r = await fetch(
      `${API_URL}/patients?or=(first_name.ilike.${term},last_name.ilike.${term})&order=created_at.desc`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!r.ok) throw new Error('Server error');
    return (await r.json()).map(mapPatient);
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache('patients');
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
