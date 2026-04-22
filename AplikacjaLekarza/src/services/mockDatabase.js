/**
 * Mock Database Service
 * Provides dummy patient data and functions to fetch patient information
 */

const mockPatients = [
  {
    id: '1',
    firstName: 'Jan',
    lastName: 'Kowalski',
    age: 45,
    diagnosis: 'Nadciśnienie tętnicze',
    lastVisitDate: '2026-04-20',
    notes: 'Wizyta kontrolna.',
    medicalHistory: 'Cukrzyca typu 2, Nadciśnienie',
    currentMedications: 'Lisinopryl',
  },
  {
    id: '2',
    firstName: 'Maria',
    lastName: 'Nowak',
    age: 32,
    diagnosis: 'Astma oskrzelowa',
    lastVisitDate: '2026-04-15',
    notes: 'Astma kontrolowana.',
    medicalHistory: 'Alergie sezonowe',
    currentMedications: 'Salbutamol',
  },
  {
    id: '3',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    age: 58,
    diagnosis: 'Cukrzyca typu 2',
    lastVisitDate: '2026-04-10',
    notes: 'Cukry ustabilizowane.',
    medicalHistory: 'Brak',
    currentMedications: 'Metformina',
  },
];

/**
 * Get all patients
 * @returns {Array} Array of all patient objects
 */
export const getAllPatients = () => {
  return mockPatients;
};

/**
 * Get a patient by ID
 * @param {string} patientId - The patient's ID
 * @returns {Object|null} Patient object if found, null otherwise
 */
export const getPatientById = (patientId) => {
  return mockPatients.find((patient) => patient.id === patientId) || null;
};

/**
 * Search patients by name
 * @param {string} searchTerm - The search term
 * @returns {Array} Array of matching patients
 */
export const searchPatients = (searchTerm) => {
  const term = searchTerm.toLowerCase();
  return mockPatients.filter(
    (patient) =>
      patient.firstName.toLowerCase().includes(term) ||
      patient.lastName.toLowerCase().includes(term)
  );
};

export default mockPatients;
