import { create } from 'zustand'
import type { Fazenda, Talhao, Produto, Aplicacao, Notificacao, DashboardStats } from '@/types'

interface AppState {
  fazendas: Fazenda[]
  talhoes: Talhao[]
  produtos: Produto[]
  aplicacoes: Aplicacao[]
  notificacoes: Notificacao[]
  stats: DashboardStats | null
  isOnline: boolean
  isSyncing: boolean
  selectedFazendaId: string | null
  /** Timestamp (ms) of the last successful server pull — 0 = never pulled.
   *  Pages subscribe to this to know when to re-run their local Dexie queries. */
  lastServerSyncAt: number

  setFazendas: (f: Fazenda[]) => void
  setTalhoes: (t: Talhao[]) => void
  setProdutos: (p: Produto[]) => void
  setAplicacoes: (a: Aplicacao[]) => void
  setNotificacoes: (n: Notificacao[]) => void
  setStats: (s: DashboardStats) => void
  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setSelectedFazenda: (id: string | null) => void
  setLastServerSyncAt: (ts: number) => void

  addFazenda: (f: Fazenda) => void
  updateFazenda: (id: string, updates: Partial<Fazenda>) => void
  deleteFazenda: (id: string) => void

  addTalhao: (t: Talhao) => void
  updateTalhao: (id: string, updates: Partial<Talhao>) => void

  addProduto: (p: Produto) => void
  updateProduto: (id: string, updates: Partial<Produto>) => void
  deleteProduto: (id: string) => void

  addAplicacao: (a: Aplicacao) => void

  markNotificacaoLida: (id: string) => void
  unreadCount: () => number
}

export const useAppStore = create<AppState>()((set, get) => ({
  fazendas: [],
  talhoes: [],
  produtos: [],
  aplicacoes: [],
  notificacoes: [],
  stats: null,
  isOnline: true,
  isSyncing: false,
  selectedFazendaId: null,
  lastServerSyncAt: 0,

  setFazendas: (fazendas) => set({ fazendas }),
  setTalhoes: (talhoes) => set({ talhoes }),
  setProdutos: (produtos) => set({ produtos }),
  setAplicacoes: (aplicacoes) => set({ aplicacoes }),
  setNotificacoes: (notificacoes) => set({ notificacoes }),
  setStats: (stats) => set({ stats }),
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setSelectedFazenda: (selectedFazendaId) => set({ selectedFazendaId }),
  setLastServerSyncAt: (lastServerSyncAt) => set({ lastServerSyncAt }),

  addFazenda: (f) => set((s) => ({ fazendas: [...s.fazendas, f] })),
  updateFazenda: (id, updates) =>
    set((s) => ({ fazendas: s.fazendas.map((f) => (f.id === id ? { ...f, ...updates } : f)) })),
  deleteFazenda: (id) =>
    set((s) => ({ fazendas: s.fazendas.filter((f) => f.id !== id) })),

  addTalhao: (t) => set((s) => ({ talhoes: [...s.talhoes, t] })),
  updateTalhao: (id, updates) =>
    set((s) => ({ talhoes: s.talhoes.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),

  addProduto: (p) => set((s) => ({ produtos: [...s.produtos, p] })),
  updateProduto: (id, updates) =>
    set((s) => ({ produtos: s.produtos.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
  deleteProduto: (id) =>
    set((s) => ({ produtos: s.produtos.filter((p) => p.id !== id) })),

  addAplicacao: (a) => set((s) => ({ aplicacoes: [...s.aplicacoes, a] })),

  markNotificacaoLida: (id) =>
    set((s) => ({
      notificacoes: s.notificacoes.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    })),
  unreadCount: () => get().notificacoes.filter((n) => !n.lida).length,
}))
