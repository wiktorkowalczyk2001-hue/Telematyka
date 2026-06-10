import { getCache, setCache, queuePendingOp, isNetworkError } from './offlineCache';

const API_URL = typeof window !== 'undefined' ? '/api' : 'http://192.168.0.31:3001';

const mapVisit = (v) => ({
  id: v.id,
  doctorId: v.doctor_id,
  patientId: v.patient_id,
  visitDate: v.visit_date,
  visitTime: v.visit_time,
  reason: v.reason,
  soapSubjective: v.soap_subjective,
  soapObjective: v.soap_objective,
  soapAssessment: v.soap_assessment,
  soapPlan: v.soap_plan,
  createdAt: v.created_at,
});

/**
 * Fetch visits for a specific date, filtered by doctor
 */
export const fetchVisitsByDate = async (date, doctorId) => {
  if (!doctorId) throw new Error('Doctor ID is required');
  
  try {
    const r = await fetch(
      `${API_URL}/visits?visit_date=eq.${date}&doctor_id=eq.${doctorId}&order=visit_time.asc&select=*,patients(first_name,last_name,age,pesel)`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!r.ok) throw new Error('Failed to fetch visits');
    const data = await r.json();
    
    // Cache per-doctor
    const cached = (await getCache(`visits_${doctorId}`)) || [];
    const otherDates = cached.filter(v => v.visit_date !== date);
    await setCache(`visits_${doctorId}`, [...otherDates, ...data]);
    
    return data.map((v) => ({
      ...mapVisit(v),
      patientName: v.patients ? `${v.patients.first_name} ${v.patients.last_name}` : 'Nieznany',
      patientAge: v.patients?.age ?? 0,
      patientPesel: v.patients?.pesel ?? '',
    }));
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache(`visits_${doctorId}`);
      if (!cached) return [];
      return cached
        .filter((v) => v.visit_date === date)
        .sort((a, b) => (a.visit_time || '').localeCompare(b.visit_time || ''))
        .map((v) => ({
          ...mapVisit(v),
          patientName: v.patients ? `${v.patients.first_name} ${v.patients.last_name}` : 'Nieznany',
          patientAge: v.patients?.age ?? 0,
          patientPesel: v.patients?.pesel ?? '',
        }));
    }
    throw e;
  }
};

/**
 * Fetch all marked dates (dates with visits) for current doctor
 */
export const fetchMarkedDates = async (doctorId) => {
  if (!doctorId) throw new Error('Doctor ID is required');
  
  try {
    // Get all visits for this doctor
    const r = await fetch(
      `${API_URL}/visits?doctor_id=eq.${doctorId}&select=visit_date`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!r.ok) throw new Error('Failed to fetch dates');
    const data = await r.json();
    
    const counts = {};
    data.forEach((v) => { counts[v.visit_date] = (counts[v.visit_date] || 0) + 1; });
    
    // Cache per-doctor
    await setCache(`marked_dates_${doctorId}`, counts);
    
    return counts;
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache(`marked_dates_${doctorId}`);
      if (!cached) return {};
      return cached;
    }
    throw e;
  }
};

/**
 * Add new visit (associated with current doctor)
 */
export const addVisit = async (visitData, doctorId) => {
  if (!doctorId) throw new Error('Doctor ID is required');
  
  const body = {
    patient_id: visitData.patientId,
    doctor_id: doctorId, // Assign to current doctor
    visit_date: visitData.visitDate,
    visit_time: visitData.visitTime,
    reason: visitData.reason || 'Brak wpisu',
  };
  try {
    const r = await fetch(`${API_URL}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Failed to add visit');
    const data = await r.json();
    const visit = data[0];
    
    // Cache per-doctor
    const cached = (await getCache(`visits_${doctorId}`)) || [];
    await setCache(`visits_${doctorId}`, [...cached, visit]);
    
    return mapVisit(visit);
  } catch (e) {
    if (isNetworkError(e)) {
      
      const tempId = 'pending_' + Date.now();
      await queuePendingOp({ url: `${API_URL}/visits`, method: 'POST', body: JSON.stringify(body), tempId });
      const tempRaw = { id: tempId, ...body, created_at: new Date().toISOString(), _pending: true };
      const cached = (await getCache(`visits_${doctorId}`)) || [];
      await setCache(`visits_${doctorId}`, [...cached, tempRaw]);
      
      return mapVisit(tempRaw);
    }
    throw e;
  }
};

/**
 * Save visit SOAP notes, filtered by doctor
 */
export const saveVisitSOAP = async (visitId, soap, doctorId) => {
  if (!doctorId) throw new Error('Doctor ID is required');
  
  const body = {
    soap_subjective: soap.subjective,
    soap_objective: soap.objective,
    soap_assessment: soap.assessment,
    soap_plan: soap.plan,
  };
  
  try {
    // Query with doctor_id filter for security
    const r = await fetch(
      `${API_URL}/visits?id=eq.${visitId}&doctor_id=eq.${doctorId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body),
      }
    );
    
    if (!r.ok) throw new Error('Failed to save SOAP');
    
    // Update cache
    const cached = (await getCache(`visits_${doctorId}`)) || [];
    await setCache(`visits_${doctorId}`, cached.map((v) => (v.id === visitId ? { ...v, ...body } : v)));
    
    return r.json();
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({
        _table: 'visits',
        method: 'PATCH',
        url: `${API_URL}/visits?id=eq.${visitId}`,
        body: JSON.stringify(body),
      });
      
      const cached = (await getCache(`visits_${doctorId}`)) || [];
      await setCache(`visits_${doctorId}`, cached.map((v) => (v.id === visitId ? { ...v, ...body } : v)));
      
      return;
    }
    throw e;
  }
};

/**
 * Delete visit, filtered by doctor
 */
export const deleteVisit = async (visitId, doctorId) => {
  if (!doctorId) throw new Error('Doctor ID is required');
  
  try {
    // Query with doctor_id filter for security
    const r = await fetch(
      `${API_URL}/visits?id=eq.${visitId}&doctor_id=eq.${doctorId}`,
      { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!r.ok) throw new Error('Failed to delete visit');
    
    // Update cache
    const cached = (await getCache(`visits_${doctorId}`)) || [];
    await setCache(`visits_${doctorId}`, cached.filter((v) => v.id !== visitId));
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({
        _table: 'visits',
        method: 'DELETE',
        url: `${API_URL}/visits?id=eq.${visitId}`,
        body: null,
      });
      
      const cached = (await getCache(`visits_${doctorId}`)) || [];
      await setCache(`visits_${doctorId}`, cached.filter((v) => v.id !== visitId));
      
      return;
    }
    throw e;
  }
};

/**
 * Fetch all visits for a specific patient (doctor-filtered)
 */
export const fetchPatientVisits = async (patientId, doctorId) => {
  if (!doctorId) throw new Error('Doctor ID is required');
  
  try {
    // Filter by both patient_id and doctor_id
    const r = await fetch(
      `${API_URL}/visits?patient_id=eq.${patientId}&doctor_id=eq.${doctorId}&order=visit_date.desc,visit_time.desc`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!r.ok) throw new Error('Failed to fetch patient visits');
    
    // Update cache
    const data = await r.json();
    const cached = (await getCache(`visits_${doctorId}`)) || [];
    const otherVisits = cached.filter(v => v.patient_id !== patientId);
    await setCache(`visits_${doctorId}`, [...otherVisits, ...data]);
    
    return data.map(mapVisit);
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache(`visits_${doctorId}`);
      if (cached) return cached.filter((v) => v.patient_id === patientId).map(mapVisit);
    }
    throw e;
  }
};
