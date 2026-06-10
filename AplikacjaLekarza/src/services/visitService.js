import { getCache, setCache, queuePendingOp, isNetworkError } from './offlineCache';

const API_URL = typeof window !== 'undefined' ? '/api' : 'http://192.168.0.31:3001';

const mapVisit = (v) => ({
  id: v.id,
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

export const fetchVisitsByDate = async (date) => {
  try {
    const r = await fetch(
      `${API_URL}/visits?visit_date=eq.${date}&order=visit_time.asc&select=*,patients(first_name,last_name,age,pesel)`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!r.ok) throw new Error('Failed to fetch visits');
    const data = await r.json();
    return data.map((v) => ({
      ...mapVisit(v),
      patientName: v.patients ? `${v.patients.first_name} ${v.patients.last_name}` : 'Nieznany',
      patientAge: v.patients?.age ?? 0,
      patientPesel: v.patients?.pesel ?? '',
    }));
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache('visits');
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

export const fetchMarkedDates = async () => {
  try {
    const r = await fetch(`${API_URL}/visits?select=visit_date`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r.ok) throw new Error('Failed to fetch dates');
    const data = await r.json();
    const counts = {};
    data.forEach((v) => { counts[v.visit_date] = (counts[v.visit_date] || 0) + 1; });
    return counts;
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache('visits');
      if (!cached) return {};
      const counts = {};
      cached.forEach((v) => { counts[v.visit_date] = (counts[v.visit_date] || 0) + 1; });
      return counts;
    }
    throw e;
  }
};

export const addVisit = async (visitData) => {
  const body = {
    patient_id: visitData.patientId,
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
    return mapVisit(visit);
  } catch (e) {
    if (isNetworkError(e)) {
      const tempId = 'pending_' + Date.now();
      await queuePendingOp({ url: `${API_URL}/visits`, method: 'POST', body: JSON.stringify(body), tempId });
      const tempRaw = { id: tempId, ...body, created_at: new Date().toISOString(), _pending: true };
      const cached = (await getCache('visits')) || [];
      await setCache('visits', [...cached, tempRaw]);
      return mapVisit(tempRaw);
    }
    throw e;
  }
};

export const saveVisitSOAP = async (visitId, soap) => {
  const body = {
    soap_subjective: soap.subjective,
    soap_objective: soap.objective,
    soap_assessment: soap.assessment,
    soap_plan: soap.plan,
  };
  try {
    const r = await fetch(`${API_URL}/visits?id=eq.${visitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Failed to save SOAP');
    return r.json();
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({ url: `${API_URL}/visits?id=eq.${visitId}`, method: 'PATCH', body: JSON.stringify(body) });
      const cached = (await getCache('visits')) || [];
      await setCache('visits', cached.map((v) => (v.id === visitId ? { ...v, ...body } : v)));
      return;
    }
    throw e;
  }
};

export const deleteVisit = async (visitId) => {
  try {
    const r = await fetch(`${API_URL}/visits?id=eq.${visitId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!r.ok) throw new Error('Failed to delete visit');
    const cached = (await getCache('visits')) || [];
    await setCache('visits', cached.filter((v) => v.id !== visitId));
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({ url: `${API_URL}/visits?id=eq.${visitId}`, method: 'DELETE', body: null });
      const cached = (await getCache('visits')) || [];
      await setCache('visits', cached.filter((v) => v.id !== visitId));
      return;
    }
    throw e;
  }
};

export const fetchPatientVisits = async (patientId) => {
  try {
    const r = await fetch(
      `${API_URL}/visits?patient_id=eq.${patientId}&order=visit_date.desc,visit_time.desc`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!r.ok) throw new Error('Failed to fetch patient visits');
    return (await r.json()).map(mapVisit);
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await getCache('visits');
      if (cached) return cached.filter((v) => v.patient_id === patientId).map(mapVisit);
    }
    throw e;
  }
};
