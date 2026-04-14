/**
 * Auto-migration via Supabase RPC.
 *
 * As migrações de schema agora são gerenciadas pelo Supabase CLI:
 *   supabase db push
 *
 * Esta função mantém compatibilidade com código existente mas não executa
 * mais migrations automaticamente — isso evita executar DDL arbitrário
 * a cada cold-start e é mais seguro em produção.
 */

export async function runSupabaseMigrations(): Promise<void> {
  // No-op: migrations are managed via Supabase CLI (`supabase db push`)
  return
}
