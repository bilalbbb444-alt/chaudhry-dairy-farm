import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ehnpsecmvtntnfooaoha.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobnBzZWNtdnRudG5mb29hb2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjkyNTMsImV4cCI6MjEwMjY0NTI1M30.PCgArJm2lZ3lxhPeNb1jQgGfCULHqh_vqOgHZAy93II";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
