import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://iksflzfyilfxqjaeiqpn.supabase.co";

const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlrc2ZsemZ5aWxmeHFqYWVpcXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDEwNDgsImV4cCI6MjA5NTE3NzA0OH0.HAAf4mlFMGI-9l7Y7XjlDBJqU95l3f6LtEZAPLbXta4";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);