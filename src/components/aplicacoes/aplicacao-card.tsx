import { cn, formatDate, culturaLabel, culturaIcon, produtoTipoLabel, diasParaProxima } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Aplicacao } from '@/types'
import { Calendar, Leaf, Package } from 'lucide-react'

interface AplicacaoCardProps {
  aplicacao: Aplicacao
  showTalhao?: boolean
}

export function AplicacaoCard({ aplicacao, showTalhao = true }: AplicacaoCardProps) {
  const dias = diasParaProxima(aplicacao.proxima_aplicacao)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {showTalhao && aplicacao.talhao && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
              <Leaf className="w-3.5 h-3.5" />
              <span>{aplicacao.talhao.nome}</span>
              <span className="text-gray-300">·</span>
              <span>{culturaIcon((aplicacao.talhao as any).cultura)} {culturaLabel((aplicacao.talhao as any).cultura)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
            <Package className="w-3.5 h-3.5 text-gray-400" />
            {aplicacao.produto?.nome || 'Produto'}
          </div>
          {aplicacao.produto && (
            <span className="text-xs text-gray-500">{produtoTipoLabel(aplicacao.produto.tipo as any)}</span>
          )}
        </div>
        <StatusBadge status={aplicacao.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <div>
            <div className="text-gray-400">Aplicado</div>
            <div className="font-medium text-gray-700">{formatDate(aplicacao.data_aplicacao)}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <div>
            <div className="text-gray-400">Próxima</div>
            <div className={cn('font-medium', aplicacao.status === 'atrasado' ? 'text-red-600' : aplicacao.status === 'hoje' ? 'text-blue-600' : 'text-gray-700')}>
              {formatDate(aplicacao.proxima_aplicacao)}
              {dias !== 0 && <span className="ml-1 text-gray-400">({dias > 0 ? `em ${dias}d` : `${Math.abs(dias)}d atrás`})</span>}
            </div>
          </div>
        </div>
      </div>

      {aplicacao.observacoes && (
        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">{aplicacao.observacoes}</p>
      )}
    </div>
  )
}
