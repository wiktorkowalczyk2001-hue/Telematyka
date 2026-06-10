/**
 * BACKEND ENDPOINTS - Doctor Approval System
 * 
 * Dodaj te endpointy do głównego Express app
 * 
 * TODO: Zainstaluj: npm install bcrypt supabase
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
);

/**
 * POST /auth/register
 * Register new doctor account
 * 
 * Body: {
 *   email: string
 *   password: string
 *   firstName: string
 *   lastName: string
 *   specialization: string
 *   pwzNumber: string (PWZ/00001/2023)
 *   nip: string (10 digits)
 *   clinicName: string
 *   phone: string
 * }
 */
router.post('/auth/register', async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      specialization,
      pwzNumber,
      nip,
      clinicName,
      phone,
    } = req.body;

    // Validation
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    if (!firstName || !lastName || !pwzNumber || !nip) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash password (use bcrypt)
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert user with status='pending'
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password_hash: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          specialization,
          pwz_number: pwzNumber,
          nip,
          clinic_name: clinicName,
          status: 'pending', // ← KEY: Set to pending, not approved
        },
      ])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // TODO: Send email to admin
    // await notifyAdminOfPendingRegistration(data[0]);

    res.json({
      success: true,
      message: 'Registration submitted. Awaiting admin approval.',
      userId: data[0].id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/pending-doctors
 * Get list of doctors awaiting approval
 * 
 * Query params: none
 * Response: [{id, email, first_name, last_name, ...}]
 */
router.get('/admin/pending-doctors', async (req, res) => {
  try {
    // TODO: Check if user is admin
    // if (!isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/approve-doctor
 * Approve or reject doctor registration
 * 
 * Body: {
 *   userId: string (UUID)
 *   approved: boolean (true = approve, false = reject)
 *   notes?: string (optional rejection notes)
 * }
 */
router.post('/admin/approve-doctor', async (req, res) => {
  try {
    const { userId, approved, notes } = req.body;

    // TODO: Verify admin authorization
    // if (!isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });

    if (!userId || typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newStatus = approved ? 'approved' : 'rejected';

    const { data, error } = await supabase
      .from('users')
      .update({
        status: newStatus,
        admin_notes: notes || null,
        approved_at: approved ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // TODO: Send email to doctor
    // const doctor = data[0];
    // if (approved) {
    //   await sendEmailApproved(doctor.email, doctor.first_name);
    // } else {
    //   await sendEmailRejected(doctor.email, doctor.first_name, notes);
    // }

    res.json({
      success: true,
      message: `Doctor ${approved ? 'approved' : 'rejected'}`,
      doctor: data[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Email notifications (stub)
 */
async function sendEmailApproved(email, firstName) {
  console.log(`[EMAIL] Account approved for ${email}`);
  // TODO: Implement email sending
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: email,
  //   from: 'noreply@telemed.pl',
  //   subject: 'Twoje konto zostało zatwierdzone!',
  //   html: `Witaj ${firstName}! Twoje konto w systemie Telemed zostało zatwierdzone...`,
  // });
}

async function sendEmailRejected(email, firstName, reason) {
  console.log(`[EMAIL] Account rejected for ${email}: ${reason}`);
  // TODO: Implement email sending
}

/**
 * POST /upload-document
 * Upload file to Supabase Storage and create metadata record
 * 
 * FormData: {
 *   file: File
 *   patientId: string
 *   visitId?: string
 *   description?: string
 * }
 */
router.post('/upload-document', async (req, res) => {
  try {
    // TODO: Implement using multer + Supabase Storage
    // const file = req.files.file;
    // const { patientId, visitId, description } = req.body;
    //
    // const storagePath = `medical-docs/${patientId}/${Date.now()}-${file.name}`;
    // const { data, error } = await supabase.storage
    //   .from('medical-documents')
    //   .upload(storagePath, file.data);
    //
    // if (error) throw error;
    //
    // res.json({ success: true, storagePath });

    res.json({ success: true, message: 'Upload endpoint not yet implemented' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

/**
 * ============================================================
 * INTEGRATION EXAMPLE
 * ============================================================
 * 
 * W głównym app.js:
 * 
 * const authRoutes = require('./routes/auth');
 * app.use('/auth', authRoutes);
 * app.use('/admin', authRoutes);
 * 
 * ============================================================
 */
