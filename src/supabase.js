import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tlduotymoiyvztrwtmqs.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZHVvdHltb2l5dnp0cnd0bXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODgxNTYsImV4cCI6MjA4OTM2NDE1Nn0.0DeH18fK5hHO2ai47NHHl5GaOJ-Xs9Jhybg8beK22cM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
