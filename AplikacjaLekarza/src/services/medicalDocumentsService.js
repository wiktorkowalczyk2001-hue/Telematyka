import { getCache, setCache, queuePendingOp, isNetworkError, clearCacheIfNeeded, prepareForOfflineCache } from './offlineCache';

const API_URL = 'http://192.168.0.31:3001';
const STORAGE_URL = 'https://your-supabase-url.supabase.co/storage/v1/object/public/medical-documents';

const mapDocument = (doc) => ({
  id: doc.id,
  patientId: doc.patient_id,
  doctorId: doc.doctor_id,
  visitId: doc.visit_id,
  fileName: doc.file_name,
  fileType: doc.file_type,
  mimeType: doc.mime_type,
  storagePath: doc.storage_path,
  fileSizeBytes: doc.file_size_bytes,
  description: doc.description,
  metadata: doc.metadata,
  isEncrypted: doc.is_encrypted,
  createdAt: doc.created_at,
  updatedAt: doc.updated_at,
  downloadUrl: `${STORAGE_URL}/${doc.storage_path}`,
});

/**
 * Fetch documents for a specific patient (doctor-filtered)
 * Caches metadata only (not file content)
 */
export const fetchPatientDocuments = async (patientId, doctorId) => {
  if (!patientId) throw new Error('Patient ID is required');
  if (!doctorId) throw new Error('Doctor ID is required');

  try {
    // Filter by both patient_id and doctor_id
    const r = await fetch(
      `${API_URL}/medical-documents?patient_id=eq.${patientId}&doctor_id=eq.${doctorId}&order=created_at.desc`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!r.ok) throw new Error('Failed to fetch documents');
    const data = await r.json();

    // Cache metadata only (not file content) - per-doctor
    const cacheKey = `medicalDocs_${doctorId}`;
    const cached = (await getCache(cacheKey)) || {};
    cached[patientId] = data.map(doc => prepareForOfflineCache(doc, 'medicalDoc'));
    await setCache(cacheKey, cached);

    return data.map(mapDocument);
  } catch (e) {
    if (isNetworkError(e)) {
      const cacheKey = `medicalDocs_${doctorId}`;
      const cached = await getCache(cacheKey);
      const patientDocs = cached?.[patientId] || [];
      if (patientDocs.length > 0) {
        return patientDocs.map(mapDocument);
      }
    }
    throw e;
  }
};

/**
 * Upload document to Supabase Storage (doctor-filtered)
 * This creates the file server-side, then records metadata
 */
export const uploadDocument = async (patientId, visitId, file, description, doctorId) => {
  if (!file) throw new Error('File is required');
  if (!patientId) throw new Error('Patient ID is required');
  if (!doctorId) throw new Error('Doctor ID is required');

  const fileType = getFileTypeFromMime(file.type);
  const timestamp = Date.now();
  const storagePath = `medical-docs/${patientId}/${timestamp}-${file.name}`;

  try {
    // Step 1: Upload file to Supabase Storage
    const formData = new FormData();
    formData.append('file', file);
    formData.append('storagePath', storagePath);

    const uploadR = await fetch(`${API_URL}/upload-document`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadR.ok) throw new Error('Failed to upload file');
    const uploadResult = await uploadR.json();

    // Step 2: Record metadata in database
    const docMetadata = {
      patient_id: patientId,
      doctor_id: doctorId, // Associate with current doctor
      visit_id: visitId,
      file_name: file.name,
      file_type: fileType,
      mime_type: file.type,
      storage_path: storagePath,
      file_size_bytes: file.size,
      description,
      metadata: {
        uploadedAt: new Date().toISOString(),
        uploadedSize: file.size,
      },
    };

    const metaR = await fetch(`${API_URL}/medical-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(docMetadata),
    });

    if (!metaR.ok) throw new Error('Failed to save document metadata');
    const docRecord = await metaR.json();

    // Cache metadata - per-doctor
    const doc = docRecord[0] || docRecord;
    const cacheKey = `medicalDocs_${doctorId}`;
    const cached = (await getCache(cacheKey)) || {};
    cached[patientId] = [...(cached[patientId] || []), prepareForOfflineCache(doc, 'medicalDoc')];
    await setCache(cacheKey, cached);

    return mapDocument(doc);
  } catch (e) {
    if (isNetworkError(e)) {
      // Queue for later sync - but warn about file
      await clearCacheIfNeeded();
      await queuePendingOp({
        _table: 'medical_documents',
        method: 'POST',
        url: `${API_URL}/medical-documents`,
        body: JSON.stringify({
          patient_id: patientId,
          doctor_id: doctorId,
          visit_id: visitId,
          file_name: file.name,
          file_type: fileType,
          file_size_bytes: file.size,
          description,
          _pending_file: true, // Flag: file not uploaded yet
        }),
      });

      console.warn('Document queued for upload. File will be uploaded on next sync.');
      throw new Error('Network error: Document queued for upload when connection restored');
    }
    throw e;
  }
};

/**
 * Delete document (doctor-filtered)
 * Soft delete: just mark in metadata, cleanup happens on server
 */
export const deleteDocument = async (documentId, patientId, doctorId) => {
  if (!documentId) throw new Error('Document ID is required');
  if (!doctorId) throw new Error('Doctor ID is required');

  try {
    // Query with doctor_id filter for security
    const r = await fetch(
      `${API_URL}/medical-documents?id=eq.${documentId}&doctor_id=eq.${doctorId}`,
      { method: 'DELETE' }
    );

    if (!r.ok) throw new Error('Failed to delete document');

    // Update cache - per-doctor
    const cacheKey = `medicalDocs_${doctorId}`;
    const cached = (await getCache(cacheKey)) || {};
    if (cached[patientId]) {
      cached[patientId] = cached[patientId].filter(doc => doc.id !== documentId);
      await setCache(cacheKey, cached);
    }
  } catch (e) {
    if (isNetworkError(e)) {
      await queuePendingOp({
        _table: 'medical_documents',
        method: 'DELETE',
        url: `${API_URL}/medical-documents?id=eq.${documentId}`,
      });
      throw new Error('Delete queued for when connection restored');
    }
    throw e;
  }
};

/**
 * Helper: determine file type from MIME
 */
const getFileTypeFromMime = (mimeType) => {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image/jpeg') || mimeType.includes('image/jpg')) return 'jpg';
  if (mimeType.includes('image/png')) return 'png';
  if (mimeType.includes('dicom') || mimeType.includes('application/dicom')) return 'dicom';
  if (mimeType.includes('audio')) return 'audio';
  return 'pdf'; // Default
};

/**
 * Get download URL for a document
 * Frontend can use this to embed/view/download
 */
export const getDocumentDownloadUrl = (storagePath) => {
  return `${STORAGE_URL}/${storagePath}`;
};

/**
 * Estimate total offline storage size for documents (per-doctor)
 */
export const getOfflineCacheStats = async (doctorId) => {
  if (!doctorId) throw new Error('Doctor ID is required');
  
  const cacheKey = `medicalDocs_${doctorId}`;
  const docs = await getCache(cacheKey);
  let docCount = 0;
  let totalSize = 0;

  if (docs) {
    Object.values(docs).forEach(patientDocs => {
      patientDocs.forEach(doc => {
        docCount++;
        totalSize += doc.fileSizeBytes || 0;
      });
    });
  }

  return {
    documentCount: docCount,
    estimatedSizeBytes: totalSize,
    estimatedSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
  };
};
