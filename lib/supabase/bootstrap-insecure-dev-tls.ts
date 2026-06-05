/**
 * Corporate SSL inspection often breaks Node’s default HTTPS trust chain.
 * When SUPABASE_DEV_ALLOW_INSECURE_TLS=true in .env.local, relax verification
 * for this dev server process only (do not use in production).
 *
 * No undici — avoids pulling node: imports into Next/Webpack client bundles.
 */
if (
  process.env.NODE_ENV !== "production" &&
  (process.env.SUPABASE_DEV_ALLOW_INSECURE_TLS === "true" || process.env.SUPABASE_DEV_ALLOW_INSECURE_TLS === "1")
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
