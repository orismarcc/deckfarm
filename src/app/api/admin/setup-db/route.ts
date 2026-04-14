/**
 * Este endpoint foi desativado.
 * Migrações agora são gerenciadas exclusivamente pelo Supabase CLI:
 *
 *   supabase link --project-ref mvwlacrciloqtawayvgj
 *   supabase migration new <nome-da-migration>
 *   supabase db push
 *
 * Para criar novas migrations: adicione o arquivo em supabase/migrations/
 * e rode `supabase db push` (localmente ou via CI/CD).
 */

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint desativado. Use o Supabase CLI para migrações.' },
    { status: 410 }
  )
}
