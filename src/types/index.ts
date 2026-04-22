// Complete type definitions for DeckFarm
export type CulturaType = 'soja' | 'milho' | 'milho_safrinha' | 'gergelim' | 'feijao' | 'algodao'
export type ProdutoTipo = 'herbicida' | 'fertilizante' | 'defensivo' | 'fungicida' | 'inseticida'
export type AplicacaoStatus = 'dentro_do_prazo' | 'proximo' | 'hoje' | 'atrasado'
export type NotificacaoTipo = 'semana' | 'tres_dias' | 'amanha' | 'hoje' | 'atrasado'
export type UserRole = 'admin' | 'agronomo' | 'tecnico' | 'operador'
export type SafraStatus = 'planejada' | 'em_andamento' | 'finalizada'
export type MembroRole = 'admin' | 'agronomo' | 'tecnico' | 'operador'
export type StatusSemeadura = 'nao_iniciada' | 'em_andamento' | 'finalizada'

export interface SemeaduraEtapa {
  id: string
  talhao_id: string
  fazenda_id: string
  usuario_id: string
  etapa: number           // 1, 2, 3, ... (sequential stage number)
  area_semeada: number    // ha planted in THIS stage
  data_semeadura: string  // ISO date
  observacoes?: string
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface User {
  id: string
  nome: string
  apelido?: string  // como quer ser chamado no app
  avatar?: string   // base64 data URL for profile photo
  email: string
  senha?: string
  tipo: UserRole
  createdAt: string
  updatedAt: string
}

export interface Fazenda {
  id: string
  nome: string
  localizacao: string
  nome_produtor?: string
  area_total?: number
  usuario_id: string
  latitude?: number
  longitude?: number
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface Talhao {
  id: string
  nome: string
  area: number
  cultura: CulturaType
  fazenda_id: string
  latitude?: number
  longitude?: number
  coordenadas?: string // GeoJSON for map support
  descricao?: string
  foto?: string // base64
  // Gestão de plantio
  data_plantio?: string          // ISO date
  data_colheita_prevista?: string // ISO date (calculada ou manual)
  data_colheita_real?: string    // ISO date
  // Semeadura
  status_semeadura?: StatusSemeadura
  area_semeada?: number          // ha já semeados (≤ area)
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface Pluviometro {
  id: string
  nome: string
  fazenda_id: string
  talhao_id?: string  // optional: per-field pluviometer
  latitude?: number
  longitude?: number
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface RegistroChuva {
  id: string
  pluviometro_id: string
  fazenda_id: string
  data: string           // ISO date yyyy-MM-dd
  volume_mm: number
  observacoes?: string
  createdAt: string
}

export interface Anotacao {
  id: string
  talhao_id: string
  fazenda_id: string
  usuario_id: string
  texto: string
  fotos?: string[]       // base64
  data: string           // ISO date
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface Recomendacao {
  id: string
  fazenda_id: string
  usuario_id: string
  nome: string
  data_inicio: string
  data_fim: string
  observacoes?: string
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface RecomendacaoAplicacao {
  id: string
  recomendacao_id: string
  talhao_id: string
  produto_id: string
  data_aplicacao: string
  dose?: number
  unidade_dose?: string
  observacoes?: string
  createdAt: string
}

export interface Safra {
  id: string
  nome: string // e.g. "2025/26"
  ano_inicio: number
  ano_fim: number
  fazenda_id: string
  cultura: CulturaType
  area_plantada?: number
  data_plantio?: string
  data_colheita_prevista?: string
  data_colheita_real?: string
  status: SafraStatus
  produtividade_media?: number // sacas/ha
  observacoes?: string
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface FazendaMembro {
  id: string
  fazenda_id: string
  usuario_id: string
  usuario_nome?: string
  usuario_email: string
  role: MembroRole
  status: 'pendente' | 'ativo' | 'inativo'
  convidado_por: string
  createdAt: string
}

export interface CulturaFase {
  nome: string
  inicio_dia: number
  fim_dia: number
  descricao?: string
}

export interface Cultura {
  id: string
  nome: string
  tipo: CulturaType
  ciclo_dias: number
  fases: CulturaFase[]
}

export interface Produto {
  id: string
  nome: string
  tipo: ProdutoTipo
  prazo_medio_aplicacao?: number   // sugestão informativa — não deve ser usada em lógica de negócio
  fabricante?: string
  registro_mapa?: string
  unidade?: string
  quantidade_disponivel?: number   // estoque atual
  unidade_quantidade?: string      // ex: L, kg, g, ml, sc
  preco_unitario?: number          // R$ por unidade (para módulo financeiro)
  fazenda_id: string
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface Aplicacao {
  id: string
  talhao_id: string
  produto_id: string
  safra_id?: string
  tipo?: 'realizada' | 'planejada' // planejada = auto-agendada, realizada = concluída
  data_aplicacao: string
  proxima_aplicacao?: string
  status: AplicacaoStatus
  dose?: number
  unidade_dose?: string
  area_aplicada?: number
  responsavel?: string
  observacoes?: string
  clima?: string
  temperatura?: number
  fotos?: string[]
  usuario_id: string
  createdAt: string
  updatedAt: string
  deleted_at?: string | null  // soft-delete: null = active, string = deleted ISO timestamp
  _syncStatus?: 'synced' | 'pending' | 'conflict'
  talhao?: Talhao
  produto?: Produto
}

export interface Notificacao {
  id: string
  tipo: NotificacaoTipo
  mensagem: string
  data_referencia: string
  lida: boolean
  usuario_id: string
  aplicacao_id?: string
  talhao_id?: string
  fazenda_id?: string
  createdAt: string
  aplicacao?: Aplicacao
}

export interface DashboardStats {
  hoje: number
  atrasadas: number
  proximas: number
  dentro_prazo: number
  total_fazendas: number
  total_talhoes: number
  total_aplicacoes: number
}

export interface EstoqueMovimentacao {
  id: string
  produto_id: string
  fazenda_id: string
  usuario_id: string
  tipo: 'entrada' | 'saida' | 'ajuste'
  quantidade: number          // amount changed (always positive)
  quantidade_anterior: number
  quantidade_nova: number
  motivo?: string
  data: string                // YYYY-MM-DD
  createdAt: string
}

export interface SyncQueueItem {
  id: string
  entity: 'fazenda' | 'talhao' | 'produto' | 'aplicacao' | 'semeadura_etapa' | 'estoqueMovimentacao'
  action: 'upsert' | 'delete'
  data: Record<string, unknown>
  timestamp: string
  retries: number
}

export interface AuthSession {
  user: Omit<User, 'senha'>
  token: string
  expiresAt: string
}
