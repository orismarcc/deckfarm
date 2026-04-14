/**
 * DeckFarm — Script de migração do Supabase
 *
 * Uso:
 *   node scripts/migrate.mjs postgresql://postgres:[SENHA]@db.mvwlacrciloqtawayvgj.supabase.co:5432/postgres
 *
 * A connection string está em:
 *   Supabase Dashboard > Project Settings > Database > Connection String > URI
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const { Client } = pg

const dbUrl = process.argv[2] || process.env.DATABASE_URL

if (!dbUrl) {
  console.error('❌  Forneça a DATABASE_URL como argumento ou variável de ambiente.')
  console.error('   node scripts/migrate.mjs postgresql://postgres:[senha]@db.mvwlacrciloqtawayvgj.supabase.co:5432/postgres')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')

const migrations = [
  { file: '001_initial.sql', id: '001' },
  { file: '002_add_fields.sql', id: '002' },
]

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  try {
    await client.connect()
    console.log('✅  Conectado ao banco de dados.')

    // Cria tabela de controle de migrations se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._deckfarm_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `)

    for (const m of migrations) {
      const { rows } = await client.query(
        'SELECT id FROM public._deckfarm_migrations WHERE id = $1',
        [m.id]
      )
      if (rows.length > 0) {
        console.log(`⏭️   Migration ${m.id} já aplicada — pulando.`)
        continue
      }

      console.log(`🔄  Aplicando migration ${m.id}...`)
      const sql = readFileSync(path.join(migrationsDir, m.file), 'utf8')
      await client.query(sql)
      await client.query('INSERT INTO public._deckfarm_migrations (id) VALUES ($1)', [m.id])
      console.log(`✅  Migration ${m.id} aplicada com sucesso!`)
    }

    console.log('\n🎉  Todas as migrations foram aplicadas!')
  } catch (err) {
    console.error('❌  Erro ao aplicar migrations:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
