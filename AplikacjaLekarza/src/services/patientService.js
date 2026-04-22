/**
 * Patient Service - Handles all database operations for patients
 * Uses PostgREST API directly (without Supabase auth)
 */

import Constants from 'expo-constants';

// Zmieniono na aktualne IP Twojego komputera w sieci (192.168.8.179)
const API_URL = 'http://192.168.8.179:3001';

// Transform snake_case to camelCase for consistency with frontend
const mapPatient = (patient) => ({
  id: patient.id,
  firstName: patient.first_name,
  lastName: patient.last_name,
  pesel: patient.pesel,
  age: patient.age,
  phone: patient.phone,
  email: patient.email,
  address: patient.address,
  diagnosis: patient.primary_diagnosis,
  lastVisitDate: patient.last_visit,
  allergies: patient.allergies,
  chronicConditions: patient.chronic_conditions,
  medicalHistory: patient.medical_history,
  currentMedications: patient.medications,
  notes: patient.clinical_notes,
  createdAt: patient.created_at,
  updatedAt: patient.updated_at,
});

/**
 * Fetch all patients from the database
 * @returns {Promise<Array>} Array of patient objects or throws error
 */
export const fetchAllPatients = async () => {
  try {
    const response = await fetch(`${API_URL}/patients?order=created_at.desc`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error fetching patients:', error);
      throw error;
    }

    const data = await response.json();

    return data.map(mapPatient);
  } catch (error) {
    console.error('fetchAllPatients error:', error);
    throw error;
  }
};

/**
 * Fetch a single patient by ID
 * @param {string} patientId - The patient's UUID
 * @returns {Promise<Object>} Patient object or throws error
 */
export const fetchPatientById = async (patientId) => {
  try {
    if (!patientId) {
      throw new Error('Patient ID is required');
    }

    const response = await fetch(`${API_URL}/patients?id=eq.${patientId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error fetching patient:', error);
      throw error;
    }

    const data = await response.json();
    if (data.length === 0) {
      throw new Error('Patient not found');
    }

    return mapPatient(data[0]);
  } catch (error) {
    console.error('fetchPatientById error:', error);
    throw error;
  }
};

/**
 * Add a new patient to the database
 * @param {Object} patientData - Patient object
 * @returns {Promise<Object>} Created patient object or throws error
 */
export const addPatient = async (patientData) => {
  try {
    if (!patientData.firstName || !patientData.lastName || !patientData.pesel) {
      throw new Error('Imię, nazwisko i PESEL są wymagane');
    }

    const response = await fetch(`${API_URL}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        first_name: patientData.firstName,
        last_name: patientData.lastName,
        pesel: patientData.pesel,
        age: patientData.age || 0,
        phone: patientData.phone || '',
        email: patientData.email || '',
        address: patientData.address || '',
        primary_diagnosis: patientData.diagnosis || 'Brak wpisu',
        last_visit: patientData.lastVisitDate || new Date().toISOString().split('T')[0],
        allergies: patientData.allergies || '',
        chronic_conditions: patientData.chronicConditions || '',
        medical_history: patientData.medicalHistory || '',
        medications: patientData.currentMedications || '',
        clinical_notes: patientData.notes || '',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error adding patient:', error);
      throw error;
    }

    const data = await response.json();
    const patient = data[0] || data;

    return mapPatient(patient);
  } catch (error) {
    console.error('addPatient error:', error);
    throw error;
  }
};

/**
 * Update an existing patient
 * @param {string} patientId - Patient UUID
 * @param {Object} patientData - Updated patient data
 * @returns {Promise<Object>} Updated patient object or throws error
 */
export const updatePatient = async (patientId, patientData) => {
  try {
    if (!patientId) {
      throw new Error('Patient ID is required');
    }

    const response = await fetch(`${API_URL}/patients?id=eq.${patientId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        first_name: patientData.firstName,
        last_name: patientData.lastName,
        pesel: patientData.pesel,
        age: patientData.age,
        phone: patientData.phone,
        email: patientData.email,
        address: patientData.address,
        primary_diagnosis: patientData.diagnosis,
        last_visit: patientData.lastVisitDate,
        allergies: patientData.allergies,
        chronic_conditions: patientData.chronicConditions,
        medical_history: patientData.medicalHistory,
        medications: patientData.currentMedications,
        clinical_notes: patientData.notes,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error updating patient:', error);
      throw error;
    }

    const data = await response.json();
    const patient = data[0] || data;

    return mapPatient(patient);
  } catch (error) {
    console.error('updatePatient error:', error);
    throw error;
  }
};

/**
 * Delete a patient
 * @param {string} patientId - Patient UUID
 * @returns {Promise<void>} or throws error
 */
export const deletePatient = async (patientId) => {
  try {
    if (!patientId) {
      throw new Error('Patient ID is required');
    }

    const response = await fetch(`${API_URL}/patients?id=eq.${patientId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error deleting patient:', error);
      throw error;
    }
  } catch (error) {
    console.error('deletePatient error:', error);
    throw error;
  }
};

/**
 * Search patients by name
 * @param {string} searchTerm - Search term (first or last name)
 * @returns {Promise<Array>} Array of matching patients or throws error
 */
export const searchPatients = async (searchTerm) => {
  try {
    if (!searchTerm || searchTerm.trim() === '') {
      return fetchAllPatients();
    }

    const term = `%${searchTerm}%`;
    const response = await fetch(`${API_URL}/patients?or=(first_name.ilike.${term},last_name.ilike.${term})&order=created_at.desc`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error searching patients:', error);
      throw error;
    }

    const data = await response.json();

    return data.map(mapPatient);
  } catch (error) {
    console.error('searchPatients error:', error);
    throw error;
  }
};

/**
 * Update clinical notes for a patient (PATCH)
 * @param {string} patientId - Patient UUID
 * @param {string} notes - The new clinical notes
 * @returns {Promise<Object>} Updated patient object
 */
export const updateClinicalNotes = async (patientId, notes) => {
  try {
    if (!patientId) throw new Error('Patient ID is required');

    const response = await fetch(`${API_URL}/patients?id=eq.${patientId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clinical_notes: notes,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error updating clinical notes:', error);
      throw error;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('updateClinicalNotes error:', error);
    throw error;
  }
};
