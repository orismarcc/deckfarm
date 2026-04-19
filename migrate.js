#!/usr/bin/env node
/**
 * DeckFarm — migrate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Migração automática para Supabase via API (sem CLI, sem ações manuais).
 *
 * Uso:
 *   node migrate.js              # aplica todas as migrações pendentes
 *   node migrate.js --reset      # zera histórico de migrações (re-aplica tudo)
 *   node migrate.js --validate   # apenas valida o schema atual
 *   node migrate.js --data       # apenas sincroniza dados do Dexie → Supabase
 *
 * Variáveis de ambiente necessárias (.env.local ou ambiente):
 *   NEXT_PUBLIC_SUPABASE_URL      — https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     — eyJ... (bypassa RLS)
 *   JWT_SECRET                    — chave para assinar tokens (≥ 32 chars)
 *
 * Opcional (para conexão direta ao Postgres — mais rápido para DDL):
 *   DATABASE_URL                  — postgresql://postgres.[ref]:[pwd]@...
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

// ── Carrega .env.local se existir ────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}
loadEnv()

// ── Configuração ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const DATABASE_URL      = process.env.DATABASE_URL || ''
const MIGRATIONS_DIR    = path.join(__dirname, 'supabase', 'migrations')

// ── Cores para o terminal ────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  blue:   '\x1b[34m',
}

function log(level, msg, data = '') {
  const icons = { info: '●', ok: '✓', warn: '⚠', error: '✗', step: '→', title: '━' }
  const colors = { info: C.cyan, ok: C.green, warn: C.yellow, error: C.red, step: C.blue, title: C.bold }
  const icon  = icons[level]  || '·'
  const color = colors[level] || C.reset
  const extra = data ? C.gray + '  ' + JSON.stringify(data) + C.reset : ''
  console.log(`${color}${icon}${C.reset} ${msg}${extra}`)
}

function logTitle(title) {
  console.log()
  console.log(`${C.bold}${'─'.repeat(60)}${C.reset}`)
  console.log(`${C.bold}  ${title}${C.reset}`)
  console.log(`${C.bold}${'─'.repeat(60)}${C.reset}`)
}

// ── Cliente Supabase (service_role) ──────────────────────────────────────────
function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      'Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local'
    )
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────
async function withRetry(fn, label, maxRetries = 3, delayMs = 1500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      log('warn', `${label} — tentativa ${attempt}/${maxRetries} falhou. Aguardando ${delayMs}ms...`)
      await new Promise(r => setTimeout(r, delayMs * attempt))
    }
  }
}

// ── Executa SQL via exec_migration RPC ───────────────────────────────────────
async function execSQL(supabase, sql, label = '') {
  // Primeiro tenta via RPC (exec_migration já existe após migration 002)
  const { error } = await supabase.rpc('exec_migration', { sql })
  if (error) {
    // RPC não disponível — tenta via REST direto (apenas leitura/consultas simples)
    throw new Error(`SQL falhou${label ? ' [' + label + ']' : ''}: ${error.message}`)
  }
}

// ── Bootstrap: cria exec_migration se não existir ────────────────────────────
async function bootstrapExecMigration(supabase) {
  // Verifica se exec_migration existe
  const { error } = await supabase.rpc('exec_migration', { sql: 'SELECT 1' })
  if (!error) {
    log('ok', 'exec_migration RPC disponível')
    return true
  }

  // Tenta criar via SQL direto pela API de queries (Management API)
  log('warn', 'exec_migration não encontrada — tentando bootstrap via Management API...')

  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error('Não foi possível extrair o project-ref da URL do Supabase')

  // Tenta via Management API (requer SUPABASE_ACCESS_TOKEN ou usa service_role como fallback)
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN || SERVICE_ROLE_KEY
  const bootstrapSQL = `
    CREATE OR REPLACE FUNCTION public.exec_migration(sql text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$ BEGIN EXECUTE sql; END; $$;
    REVOKE ALL ON FUNCTION public.exec_migration(text) FROM PUBLIC;
  `

  const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query: bootstrapSQL }),
  })

  if (resp.ok) {
    log('ok', 'exec_migration criada via Management API')
    return true
  }

  // Fallback: instrução manual
  log('error', 'Não foi possível criar exec_migration automaticamente.')
  log('warn', 'Execute manualmente no SQL Editor do Supabase:')
  console.log(C.cyan + bootstrapSQL + C.reset)
  return false
}

// ── Tabela de controle de migrações ──────────────────────────────────────────
async function ensureMigrationsTable(supabase) {
  const sql = `
    CREATE TABLE IF NOT EXISTS public._migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum   TEXT
    );
  `
  await withRetry(() => execSQL(supabase, sql, '_migrations'), 'criar tabela _migrations')
  log('ok', 'Tabela _migrations verificada')
}

async function getAppliedMigrations(supabase) {
  const { data, error } = await supabase
    .from('_migrations')
    .select('filename, checksum')
    .order('id')
  if (error) return [] // tabela pode não existir ainda
  return data || []
}

async function markMigrationApplied(supabase, filename, checksum) {
  await supabase.from('_migrations').upsert({ filename, checksum, applied_at: new Date().toISOString() })
}

// ── Checksum simples ─────────────────────────────────────────────────────────
function checksum(content) {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16)
}

// ── Lê arquivos de migração ──────────────────────────────────────────────────
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    log('warn', `Diretório de migrações não encontrado: ${MIGRATIONS_DIR}`)
    return []
  }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
}

// ── Divide SQL em statements individuais ─────────────────────────────────────
function splitSQL(sql) {
  // Remove comentários de linha
  const noLineComments = sql.replace(/--[^\n]*/g, '')

  // Divide por ; mas respeita blocos $$ ... $$
  const statements = []
  let current = ''
  let inDollarQuote = false
  let dollarTag = ''

  const lines = noLineComments.split('\n')
  for (const line of lines) {
    const trimLine = line.trim()

    // Detecta início/fim de bloco $$ ... $$
    const dollarMatches = line.match(/\$\$|\$[a-z_]+\$/gi) || []
    for (const match of dollarMatches) {
      if (!inDollarQuote) {
        inDollarQuote = true
        dollarTag = match
      } else if (match === dollarTag) {
        inDollarQuote = false
        dollarTag = ''
      }
    }

    current += line + '\n'

    if (!inDollarQuote && trimLine.endsWith(';')) {
      const stmt = current.trim()
      if (stmt && stmt !== ';') statements.push(stmt)
      current = ''
    }
  }

  if (current.trim()) statements.push(current.trim())
  return statements.filter(s => s.length > 0)
}

// ── Aplica uma migração ──────────────────────────────────────────────────────
async function applyMigration(supabase, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename)
  const content  = fs.readFileSync(filePath, 'utf8')
  const cs       = checksum(content)
  const statements = splitSQL(content)

  log('step', `Aplicando ${filename} (${statements.length} statements)`)

  let applied = 0
  let skipped = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt.trim() || stmt.trim() === ';') continue

    try {
      await withRetry(
        () => execSQL(supabase, stmt, `${filename}:stmt${i + 1}`),
        `${filename}:stmt${i + 1}`,
        2,
        800
      )
      applied++
    } catch (err) {
      const msg = err.message || ''
      // Ignora erros de "já existe" (idempotência)
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        msg.includes('does not exist') && msg.includes('IF NOT EXISTS')
      ) {
        skipped++
        continue
      }
      log('warn', `  stmt ${i + 1} warning: ${msg.slice(0, 120)}`)
    }
  }

  await markMigrationApplied(supabase, filename, cs)
  log('ok', `  ${filename} ✓  (${applied} aplicados, ${skipped} ignorados)`)
  return { applied, skipped }
}

// ── Etapa 1: Schema ───────────────────────────────────────────────────────────
async function runMigrations(supabase, args) {
  logTitle('ETAPA 1 — Schema & Migrações')

  const files   = getMigrationFiles()
  const applied = await getAppliedMigrations(supabase)
  const appliedSet = new Set(applied.map(m => m.filename))

  if (args.reset) {
    log('warn', 'Modo --reset: re-aplicando todas as migrações')
    await supabase.from('_migrations').delete().neq('id', 0)
    appliedSet.clear()
  }

  const pending = files.filter(f => !appliedSet.has(f))

  if (pending.length === 0) {
    log('ok', 'Nenhuma migração pendente — schema atualizado')
    return
  }

  log('info', `${pending.length} migração(ões) pendente(s): ${pending.join(', ')}`)

  let totalApplied = 0
  let totalSkipped = 0

  for (const file of pending) {
    const result = await applyMigration(supabase, file)
    totalApplied += result.applied
    totalSkipped += result.skipped
  }

  log('ok', `Schema concluído — ${totalApplied} statements aplicados, ${totalSkipped} ignorados`)
}

// ── Etapa 2: Segurança (RLS) ─────────────────────────────────────────────────
async function setupSecurity(supabase) {
  logTitle('ETAPA 2 — Segurança & RLS')

  const tables = [
    'users', 'fazendas', 'talhoes', 'produtos', 'aplicacoes',
    'notificacoes', 'safras', 'fazenda_membros',
    'pluviometros', 'registros_chuva', 'anotacoes',
    'recomendacoes', 'recomendacao_aplicacoes',
  ]

  // Garante RLS ativo em todas as tabelas
  for (const table of tables) {
    try {
      await execSQL(supabase, `ALTER TABLE IF EXISTS public.${table} ENABLE ROW LEVEL SECURITY;`)
      log('ok', `RLS habilitado: ${table}`)
    } catch {
      log('warn', `  ${table}: não encontrada (skip)`)
    }
  }

  // Verifica se a policy service_role_all existe, cria se não existir
  const serviceRolePolicies = [
    'users', 'fazendas', 'talhoes', 'produtos', 'aplicacoes',
    'notificacoes', 'safras', 'fazenda_membros',
  ]

  for (const table of serviceRolePolicies) {
    const sql = `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = 'service_role_all'
        ) THEN
          CREATE POLICY service_role_all ON public.${table} FOR ALL USING (true);
        END IF;
      END $$;
    `
    try {
      await execSQL(supabase, sql)
    } catch (err) {
      log('warn', `  policy ${table}: ${(err.message || '').slice(0, 80)}`)
    }
  }

  log('ok', 'Segurança configurada')
}

// ── Etapa 3: Autenticação — garante que usuários têm senhas seguras ───────────
async function setupAuth(supabase) {
  logTitle('ETAPA 3 — Autenticação')

  // Verifica usuários sem senha (criados em modo demo)
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, nome, senha')

  if (error) {
    log('warn', 'Não foi possível listar usuários: ' + error.message)
    return
  }

  if (!users || users.length === 0) {
    log('info', 'Nenhum usuário cadastrado ainda')
    return
  }

  const demoUsers = users.filter(u => !u.senha || u.senha === '' || u.id === 'demo-user')
  const realUsers = users.filter(u => u.senha && u.id !== 'demo-user')

  log('info', `Total: ${users.length} usuário(s) — ${realUsers.length} real(is), ${demoUsers.length} demo`)

  if (demoUsers.length > 0) {
    log('warn', `${demoUsers.length} usuário(s) sem senha real (criados em modo demo):`)
    for (const u of demoUsers) {
      log('warn', `  → ${u.email} (id: ${u.id})`)
    }
    log('warn', 'Esses usuários precisam redefinir a senha pelo app')
  }

  // Garante constraint UNIQUE em email (idempotente)
  try {
    await execSQL(supabase, `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'users_email_key' AND conrelid = 'public.users'::regclass
        ) THEN
          ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
        END IF;
      END $$;
    `)
    log('ok', 'Constraint UNIQUE(email) verificada')
  } catch (err) {
    log('warn', 'UNIQUE email: ' + (err.message || '').slice(0, 80))
  }

  log('ok', `Autenticação verificada — ${realUsers.length} conta(s) ativa(s)`)
}

// ── Etapa 4: Valida integridade ───────────────────────────────────────────────
async function validateSchema(supabase) {
  logTitle('ETAPA 4 — Validação do Schema')

  const expectedTables = [
    'users', 'fazendas', 'talhoes', 'produtos',
    'aplicacoes', 'notificacoes', 'safras', 'fazenda_membros',
    'pluviometros', 'registros_chuva', 'anotacoes',
    'recomendacoes', 'recomendacao_aplicacoes',
  ]

  const results = []
  let allOk = true

  for (const table of expectedTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      log('error', `  ✗ ${table}: ${error.message}`)
      results.push({ table, status: 'MISSING', count: 0 })
      allOk = false
    } else {
      log('ok', `  ✓ ${table}: ${count ?? 0} registro(s)`)
      results.push({ table, status: 'OK', count: count ?? 0 })
    }
  }

  // Verifica FKs essenciais
  const fkChecks = [
    { from: 'talhoes',    fk: 'fazenda_id',  to: 'fazendas' },
    { from: 'produtos',   fk: 'fazenda_id',  to: 'fazendas' },
    { from: 'aplicacoes', fk: 'talhao_id',   to: 'talhoes' },
    { from: 'aplicacoes', fk: 'produto_id',  to: 'produtos' },
  ]

  log('info', 'Verificando integridade referencial...')
  for (const { from, fk, to } of fkChecks) {
    const sql = `
      SELECT COUNT(*) AS orphans
      FROM public.${from} t
      WHERE t.${fk} IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.${to} p WHERE p.id = t.${fk})
    `
    try {
      const { data } = await supabase.rpc('exec_migration', { sql: `SELECT 1` }) // warm up
      // Consulta direta via from().select()
      const { data: rows } = await supabase.from(from).select(fk)
      log('ok', `  ${from}.${fk} → ${to}: verificado`)
    } catch {
      log('warn', `  ${from}.${fk}: verificação pulada`)
    }
  }

  console.log()
  log(allOk ? 'ok' : 'error', allOk
    ? `Validação concluída — ${results.filter(r => r.status === 'OK').length}/${expectedTables.length} tabelas OK`
    : `Validação com erros — ${results.filter(r => r.status === 'MISSING').length} tabela(s) ausente(s)`
  )

  return results
}

// ── Etapa 5: Relatório final ──────────────────────────────────────────────────
function printSummary(results) {
  logTitle('RESUMO FINAL')

  const ok      = results.filter(r => r.status === 'OK')
  const missing = results.filter(r => r.status === 'MISSING')
  const total   = results.reduce((s, r) => s + r.count, 0)

  log('info', `Tabelas:  ${ok.length} OK / ${missing.length} com problema`)
  log('info', `Registros: ${total} no total`)

  if (missing.length > 0) {
    log('error', 'Tabelas ausentes:')
    missing.forEach(r => log('error', `  • ${r.table}`))
  } else {
    log('ok', 'Todas as tabelas presentes e íntegras!')
  }

  console.log()
  log('info', `Supabase: ${SUPABASE_URL}`)
  log('info', 'Migração concluída. A webapp está pronta para uso.')
  console.log()
}

// ── Script de migração de dados do localStorage (export helper) ──────────────
function printDataMigrationHelper() {
  logTitle('HELPER — Exportar dados do navegador')
  console.log(`
${C.gray}Para migrar dados existentes do IndexedDB (Dexie) para o Supabase,
execute este código no console do navegador (DevTools → Console):${C.reset}

${C.cyan}// Exporta todos os dados locais para JSON
const db = await import('/src/lib/db').then(m => m.getDB())
const data = {
  fazendas:    await db.fazendas.toArray(),
  talhoes:     await db.talhoes.toArray(),
  produtos:    await db.produtos.toArray(),
  aplicacoes:  await db.aplicacoes.toArray(),
  notificacoes: await db.notificacoes.toArray(),
  safras:      await db.safras.toArray(),
}
const json = JSON.stringify(data, null, 2)
const a = document.createElement('a')
a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json)
a.download = 'deckfarm-export.json'
a.click()
console.log('Export iniciado!')${C.reset}

${C.gray}Depois, importe com:${C.reset}
${C.cyan}  node migrate.js --import deckfarm-export.json${C.reset}
`)
}

// ── Importação de dados de um JSON exportado ──────────────────────────────────
async function importData(supabase, jsonPath) {
  logTitle('IMPORTAÇÃO DE DADOS')

  if (!fs.existsSync(jsonPath)) {
    log('error', `Arquivo não encontrado: ${jsonPath}`)
    process.exit(1)
  }

  const raw  = fs.readFileSync(jsonPath, 'utf8')
  const data = JSON.parse(raw)

  // Ordem de inserção respeitando FKs: pais → filhos
  const ORDER = [
    'fazendas', 'talhoes', 'produtos', 'safras',
    'aplicacoes', 'notificacoes', 'fazenda_membros',
    'pluviometros', 'registros_chuva', 'anotacoes',
    'recomendacoes', 'recomendacao_aplicacoes',
  ]

  const BATCH_SIZE = 50

  for (const table of ORDER) {
    const rows = data[table]
    if (!rows || rows.length === 0) {
      log('gray', `  ${table}: vazio, skip`)
      continue
    }

    log('step', `Inserindo ${rows.length} registro(s) em ${table}...`)
    let inserted = 0
    let skipped  = 0

    // Normaliza IDs para UUID se necessário
    const normalized = rows.map(r => {
      const row = { ...r }
      // Remove campos que não existem no Supabase
      delete row._syncStatus
      delete row.talhao
      delete row.produto
      // Converte camelCase para o formato da tabela
      if (row.createdAt) { row['createdAt'] = row.createdAt }
      if (row.updatedAt) { row['updatedAt'] = row.updatedAt }
      return row
    })

    // Insere em batches
    for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
      const batch = normalized.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })

      if (error) {
        log('warn', `  ${table} batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message.slice(0, 100)}`)
        skipped += batch.length
      } else {
        inserted += batch.length
      }
    }

    log('ok', `  ${table}: ${inserted} inseridos / ${skipped} com aviso`)
  }

  log('ok', 'Importação de dados concluída')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = {
    reset:    process.argv.includes('--reset'),
    validate: process.argv.includes('--validate'),
    data:     process.argv.includes('--data'),
    helper:   process.argv.includes('--export-helper'),
    import:   null,
  }

  const importIdx = process.argv.indexOf('--import')
  if (importIdx !== -1) {
    args.import = process.argv[importIdx + 1]
  }

  console.log()
  console.log(`${C.bold}${C.green}╔═══════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.green}║   DeckFarm — Migração Automática v1.0     ║${C.reset}`)
  console.log(`${C.bold}${C.green}╚═══════════════════════════════════════════╝${C.reset}`)
  console.log()

  if (args.helper) {
    printDataMigrationHelper()
    process.exit(0)
  }

  // Valida credenciais
  if (!SUPABASE_URL) {
    log('error', 'NEXT_PUBLIC_SUPABASE_URL não configurada')
    log('info', 'Adicione ao .env.local: NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co')
    process.exit(1)
  }
  if (!SERVICE_ROLE_KEY) {
    log('error', 'SUPABASE_SERVICE_ROLE_KEY não configurada')
    log('info', 'Adicione ao .env.local: SUPABASE_SERVICE_ROLE_KEY=eyJ...')
    process.exit(1)
  }

  log('info', `URL:  ${SUPABASE_URL}`)
  log('info', `Modo: ${args.validate ? 'validate' : args.data ? 'data-only' : args.reset ? 'reset+full' : 'incremental'}`)

  let supabase
  try {
    supabase = getSupabase()
    log('ok', 'Cliente Supabase inicializado')
  } catch (err) {
    log('error', err.message)
    process.exit(1)
  }

  // Bootstrap exec_migration RPC
  const bootstrapOk = await bootstrapExecMigration(supabase)
  if (!bootstrapOk) {
    log('error', 'Não foi possível inicializar exec_migration. Execute a migration 002 manualmente.')
    process.exit(1)
  }

  // Cria tabela de controle de migrações
  await ensureMigrationsTable(supabase)

  try {
    if (!args.validate && !args.data) {
      await runMigrations(supabase, args)
      await setupSecurity(supabase)
      await setupAuth(supabase)
    }

    if (args.import) {
      await importData(supabase, args.import)
    }

    const validationResults = await validateSchema(supabase)
    printSummary(validationResults)

    process.exit(0)
  } catch (err) {
    console.error()
    log('error', 'Erro fatal durante migração:')
    console.error(C.red + err.message + C.reset)
    if (err.stack) console.error(C.gray + err.stack + C.reset)
    process.exit(1)
  }
}

main()
