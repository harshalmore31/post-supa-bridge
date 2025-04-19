import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL || "https://dlebjzecztdyvlmnpkio.supabase.co";
const supabaseKey = import.meta.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZWJqemVjenRkeXZsbW5wa2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NzUzMjYsImV4cCI6MjA1NzI1MTMyNn0.juYgH2QhcR7mHDbUtNSLtupkAaSRbTXc-qJVdcrgzoc";

export const supabase = createClient(supabaseUrl, supabaseKey);