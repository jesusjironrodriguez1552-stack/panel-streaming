// USA EL LINK CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// --- 1. CONEXIÓN A SUPABASE ---
const SUPABASE_URL = 'https://izbiijrvwkuqfyxpoawb.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YmlpanJ2d2t1cWZ5eHBvYXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NzA0MTcsImV4cCI6MjA3ODI0NjQxN30.GcahHiotPV5YlwRfOUcGNyFVZTe4KpKUBuFyqm-mjO4' 
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
