import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client Configuration - Local PostgREST Setup
 * 
 * This connects to a local PostgreSQL database via PostgREST API
 * Running on localhost:3001 - Change to your IP for Expo Go on phone
 * 
 * PRODUCTION: Replace URL with your production Supabase instance
 * DEVELOPMENT with Expo Go: Replace 127.0.0.1 with your PC's IP (e.g., 192.168.X.X)
 */

const SUPABASE_URL = 'http://192.168.8.181:3001';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4YW1wbGUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MTc2NTIwMCwiZXhwIjoxOTk5OTk5OTk5fQ.CRXP3CSJqr2OtIHStPHt1JEknzkMgGOAJYEgYWEO53A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
