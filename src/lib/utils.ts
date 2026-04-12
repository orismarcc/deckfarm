import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isToday, isPast, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AplicacaoStatus, CulturaType, ProdutoTipo } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string): string {
  return format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDateLong(date: string): string {
  return format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function statusLabel(status: AplicacaoStatus): string {
  const map: Record<AplicacaoStatus, string> = {
    dentro_do_prazo: 'No prazo',
    proximo: 'Próximo',
    hoje: 'Hoje',
    atrasado: 'Atrasado',
  }
  return map[status]
}

export function statusColor(status: AplicacaoStatus): string {
  const map: Record<AplicacaoStatus, string> = {
    dentro_do_prazo: 'text-green-600 bg-green-50 border-green-200',
    proximo: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    hoje: 'text-blue-600 bg-blue-50 border-blue-200',
    atrasado: 'text-red-600 bg-red-50 border-red-200',
  }
  return map[status]
}

export function statusDot(status: AplicacaoStatus): string {
  const map: Record<AplicacaoStatus, string> = {
    dentro_do_prazo: 'bg-green-500',
    proximo: 'bg-yellow-500',
    hoje: 'bg-blue-500',
    atrasado: 'bg-red-500',
  }
  return map[status]
}

export function culturaLabel(cultura: CulturaType): string {
  const map: Record<CulturaType, string> = {
    soja: 'Soja',
    milho: 'Milho',
    milho_safrinha: 'Milho Safrinha',
    gergelim: 'Gergelim',
    feijao: 'Feijão',
    algodao: 'Algodão',
  }
  return map[cultura]
}

export function culturaIcon(cultura: CulturaType): string {
  const map: Record<CulturaType, string> = {
    soja: '🌱',
    milho: '🌽',
    milho_safrinha: '🌽',
    gergelim: '🌿',
    feijao: '🫘',
    algodao: '☁️',
  }
  return map[cultura]
}

export function produtoTipoLabel(tipo: ProdutoTipo): string {
  const map: Record<ProdutoTipo, string> = {
    herbicida: 'Herbicida',
    fertilizante: 'Fertilizante',
    defensivo: 'Defensivo',
    fungicida: 'Fungicida',
    inseticida: 'Inseticida',
  }
  return map[tipo]
}

export function produtoTipoColor(tipo: ProdutoTipo): string {
  const map: Record<ProdutoTipo, string> = {
    herbicida: 'bg-orange-100 text-orange-700',
    fertilizante: 'bg-blue-100 text-blue-700',
    defensivo: 'bg-purple-100 text-purple-700',
    fungicida: 'bg-pink-100 text-pink-700',
    inseticida: 'bg-red-100 text-red-700',
  }
  return map[tipo]
}

export function diasParaProxima(proxima: string): number {
  return differenceInDays(parseISO(proxima), new Date())
}

export function gerarId(): string {
  return crypto.randomUUID()
}
