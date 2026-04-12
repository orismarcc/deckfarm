// Complete type definitions for DeckFarm
export type CulturaType = 'soja' | 'milho' | 'milho_safrinha' | 'gergelim' | 'feijao' | 'algodao'
export type ProdutoTipo = 'herbicida' | 'fertilizante' | 'defensivo' | 'fungicida' | 'inseticida'
export type AplicacaoStatus = 'dentro_do_prazo' | 'proximo' | 'hoje' | 'atrasado'
export type NotificacaoTipo = 'semana' | 'tres_dias' | 'amanha' | 'hoje' | 'atrasado'
export type UserRole = 'admin' | 'agronomo' | 'tecnico' | 'operador'

export interface User {
  id: string
  nome: string
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
  area_total?: number
  usuario_id: string
  latitude?: number
  longitude?: number
  createdAt: string
  updatedAt: string
  // local only
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
  coordenadas?: string // GeoJSON for future map support
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
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
  prazo_medio_aplicacao: number // days
  fabricante?: string
  registro_mapa?: string
  unidade?: string
  fazenda_id: string
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface Aplicacao {
  id: string
  talhao_id: string
  produto_id: string
  data_aplicacao: string // ISO date
  proxima_aplicacao: string // ISO date - auto calculated
  status: AplicacaoStatus
  dose?: number
  unidade_dose?: string
  area_aplicada?: number
  responsavel?: string
  observacoes?: string
  clima?: string
  temperatura?: number
  usuario_id: string
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
  // joins
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
  // joins
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

export interface SyncQueueItem {
  id: string
  entity: 'fazenda' | 'talhao' | 'produto' | 'aplicacao'
  action: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
  timestamp: string
  retries: number
}

export interface AuthSession {
  user: Omit<User, 'senha'>
  token: string
  expiresAt: string
}
