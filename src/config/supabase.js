export const SUPABASE_URL = 'https://tjoimejhslonleohkfuh.supabase.co';

// Public anon key only. Never put service_role key in the APK.
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqb2ltZWpoc2xvbmxlb2hrZnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NjczNDMsImV4cCI6MjA5NDA0MzM0M30.dztZ1bMKc_kLUGIHj8zVHmpgoTO8b2USK3EQtqQFp68';

export const IS_SUPABASE_AUTH_CONFIGURED = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY,
);
