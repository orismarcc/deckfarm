'use client'
/**
 * FenologiaGuia — Modal com guia visual ilustrado por estágio fenológico.
 * Ilustrações SVG inline por fase: nenhuma dependência externa, funciona offline.
 */
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import type { CulturaType } from '@/types'

// ── Ilustrações SVG por estágio ───────────────────────────────────────────────
// Cada SVG representa a planta / órgão característico do estágio

const SVG = {

  // ── Genéricos (usados em várias culturas) ────────────────────────────────
  emergencia: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Solo */}
      <rect x="0" y="100" width="120" height="40" rx="4" fill="#a16207" opacity=".25"/>
      <rect x="0" y="100" width="120" height="8" rx="2" fill="#92400e" opacity=".35"/>
      {/* Raiz */}
      <path d="M60 100 Q55 115 48 122" stroke="#92400e" strokeWidth="2" strokeLinecap="round"/>
      <path d="M60 100 Q65 118 72 125" stroke="#92400e" strokeWidth="2" strokeLinecap="round"/>
      {/* Hipocótilo */}
      <path d="M60 100 Q58 80 60 62" stroke={cor} strokeWidth="3.5" strokeLinecap="round"/>
      {/* Cotiledones */}
      <ellipse cx="52" cy="58" rx="13" ry="8" fill={cor} opacity=".7" transform="rotate(-20 52 58)"/>
      <ellipse cx="70" cy="55" rx="13" ry="8" fill={cor} opacity=".85" transform="rotate(15 70 55)"/>
      {/* Ápice */}
      <circle cx="60" cy="50" r="5" fill={cor}/>
      {/* Seta emergindo */}
      <path d="M90 85 L90 40" stroke={cor} strokeWidth="1.5" strokeDasharray="3 2" opacity=".5"/>
      <polygon points="90,32 86,42 94,42" fill={cor} opacity=".5"/>
      <text x="95" y="38" fontSize="9" fill={cor} opacity=".7" fontFamily="system-ui">emerge</text>
    </svg>
  ),

  colheita: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Solo */}
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      {/* Trator simplificado */}
      <rect x="12" y="80" width="55" height="28" rx="5" fill="#f97316" opacity=".85"/>
      <rect x="8"  y="88" width="20" height="20" rx="10" fill="#374151" opacity=".7"/>
      <rect x="52" y="92" width="14" height="14" rx="7"  fill="#374151" opacity=".7"/>
      <rect x="25" y="72" width="28" height="12" rx="3" fill="#fb923c"/>
      {/* Planta pronta (amarela/marrom) */}
      <path d="M90 108 L90 62" stroke={cor} strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="82" cy="75" rx="11" ry="8" fill={cor} opacity=".7" transform="rotate(-15 82 75)"/>
      <ellipse cx="100" cy="78" rx="11" ry="8" fill={cor} opacity=".7" transform="rotate(20 100 78)"/>
      <ellipse cx="90" cy="65" rx="8" ry="6" fill={cor} opacity=".9"/>
    </svg>
  ),

  // ── SOJA ─────────────────────────────────────────────────────────────────
  soja_vc: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 Q58 85 60 72" stroke="#92400e" strokeWidth="2.5"/>
      <path d="M60 108 Q52 118 46 122" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M60 108 Q68 116 74 120" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Cotilédones expandidos */}
      <ellipse cx="48" cy="80" rx="15" ry="10" fill={cor} opacity=".8" transform="rotate(-25 48 80)"/>
      <ellipse cx="74" cy="77" rx="15" ry="10" fill={cor} opacity=".8" transform="rotate(20 74 77)"/>
      {/* 1ª folha simples */}
      <ellipse cx="60" cy="66" rx="9" ry="6" fill={cor} opacity=".9"/>
    </svg>
  ),

  soja_v2: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 55" stroke={cor} strokeWidth="3"/>
      <path d="M60 108 Q50 120 44 124" stroke="#92400e" strokeWidth="1.5"/>
      <path d="M60 108 Q70 118 76 122" stroke="#92400e" strokeWidth="1.5"/>
      {/* Folha trifoliada 1 */}
      <ellipse cx="44" cy="92" rx="13" ry="8" fill={cor} opacity=".7" transform="rotate(-30 44 92)"/>
      <ellipse cx="78" cy="88" rx="13" ry="8" fill={cor} opacity=".7" transform="rotate(25 78 88)"/>
      <ellipse cx="60" cy="84" rx="10" ry="6" fill={cor} opacity=".8"/>
      {/* Folha trifoliada 2 */}
      <ellipse cx="46" cy="70" rx="12" ry="7.5" fill={cor} opacity=".75" transform="rotate(-25 46 70)"/>
      <ellipse cx="76" cy="66" rx="12" ry="7.5" fill={cor} opacity=".75" transform="rotate(20 76 66)"/>
      <ellipse cx="60" cy="62" rx="9" ry="5.5" fill={cor} opacity=".85"/>
    </svg>
  ),

  soja_r1: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 28" stroke="#16a34a" strokeWidth="3.5"/>
      {/* Folhas */}
      {[92,76,62,48].map((y, i) => (
        <g key={i}>
          <ellipse cx={44} cy={y} rx="12" ry="7" fill="#16a34a" opacity={.7} transform={`rotate(-25 44 ${y})`}/>
          <ellipse cx={78} cy={y-2} rx="12" ry="7" fill="#16a34a" opacity={.7} transform={`rotate(22 78 ${y-2})`}/>
          <ellipse cx="60" cy={y-4} rx="9" ry="5.5" fill="#16a34a" opacity={.8}/>
        </g>
      ))}
      {/* Flores */}
      <circle cx="52" cy="55" r="6" fill={cor} opacity=".9"/>
      <circle cx="70" cy="48" r="6" fill={cor} opacity=".9"/>
      <circle cx="60" cy="38" r="5" fill={cor} opacity=".85"/>
      {/* Pétalas */}
      {[0,60,120,180,240,300].map(a => (
        <ellipse key={a} cx={52 + 9*Math.cos(a*Math.PI/180)} cy={55 + 9*Math.sin(a*Math.PI/180)}
          rx="4" ry="2.5" fill={cor} opacity=".6"
          transform={`rotate(${a} ${52 + 9*Math.cos(a*Math.PI/180)} ${55 + 9*Math.sin(a*Math.PI/180)})`}/>
      ))}
    </svg>
  ),

  soja_r3: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 28" stroke="#16a34a" strokeWidth="3.5"/>
      {[88,72,56].map((y, i) => (
        <g key={i}>
          <ellipse cx={44} cy={y} rx="11" ry="6.5" fill="#16a34a" opacity={.65} transform={`rotate(-25 44 ${y})`}/>
          <ellipse cx={78} cy={y-2} rx="11" ry="6.5" fill="#16a34a" opacity={.65} transform={`rotate(22 78 ${y-2})`}/>
        </g>
      ))}
      {/* Vagens pequenas */}
      <rect x="46" y="78" width="22" height="7" rx="3.5" fill={cor} opacity=".8" transform="rotate(-15 46 78)"/>
      <rect x="62" y="65" width="20" height="6" rx="3" fill={cor} opacity=".8" transform="rotate(10 62 65)"/>
      <rect x="44" y="58" width="18" height="6" rx="3" fill={cor} opacity=".75" transform="rotate(-20 44 58)"/>
    </svg>
  ),

  soja_r5: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 25" stroke="#16a34a" strokeWidth="3.5"/>
      {/* Muitas vagens */}
      {[85,72,62,52,42].map((y, i) => (
        <g key={i}>
          <rect x={36+i*2} y={y} width="24" height="9" rx="4.5" fill={cor} opacity={.8} transform={`rotate(${-15+i*7} 36 ${y})`}/>
          <rect x={66-i*2} y={y+2} width="22" height="8" rx="4" fill={cor} opacity={.75} transform={`rotate(${12-i*5} 66 ${y+2})`}/>
        </g>
      ))}
      {/* Bolinhas de grão dentro */}
      <circle cx="50" cy="86" r="2.5" fill="white" opacity=".6"/>
      <circle cx="56" cy="85" r="2.5" fill="white" opacity=".6"/>
    </svg>
  ),

  soja_r7: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 25" stroke="#a16207" strokeWidth="3.5"/>
      {/* Folhas amareladas caindo */}
      <ellipse cx="40" cy="88" rx="14" ry="8" fill="#eab308" opacity=".7" transform="rotate(-35 40 88)"/>
      <ellipse cx="82" cy="82" rx="13" ry="7" fill="#eab308" opacity=".6" transform="rotate(30 82 82)"/>
      {/* Vagens maduras */}
      {[85,70,58,46].map((y, i) => (
        <rect key={i} x={38+i*2} y={y} width="26" height="10" rx="5" fill={cor} opacity={.85} transform={`rotate(${-10+i*8} 38 ${y})`}/>
      ))}
      {/* Grãos visíveis através da vagem */}
      {[85,70,58,46].map((y, i) => [0,1,2].map(j => (
        <circle key={`${i}-${j}`} cx={43+j*7+i} cy={y+5} r="2.5" fill="#92400e" opacity=".4"/>
      )))}
    </svg>
  ),

  // ── MILHO ────────────────────────────────────────────────────────────────
  milho_v3: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 75" stroke={cor} strokeWidth="3.5"/>
      <path d="M60 108 Q48 118 42 124" stroke="#92400e" strokeWidth="1.5"/>
      <path d="M60 108 Q72 116 78 122" stroke="#92400e" strokeWidth="1.5"/>
      {/* 3 folhas */}
      <path d="M60 100 Q38 88 30 78" stroke={cor} strokeWidth="8" strokeLinecap="round" opacity=".8"/>
      <path d="M60 92 Q84 80 92 68" stroke={cor} strokeWidth="7" strokeLinecap="round" opacity=".75"/>
      <path d="M60 82 Q42 68 36 58" stroke={cor} strokeWidth="6" strokeLinecap="round" opacity=".7"/>
    </svg>
  ),

  milho_vt: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      {/* Colmo */}
      <path d="M60 108 L60 18" stroke={cor} strokeWidth="4.5"/>
      {/* Folhas */}
      {[95,82,68,55,42,30].map((y, i) => (
        <path key={i} d={i%2===0
          ? `M60 ${y} Q${35-i*2} ${y-8} ${28-i*2} ${y-20}`
          : `M60 ${y} Q${85+i*2} ${y-6} ${92+i*2} ${y-18}`}
          stroke={cor} strokeWidth={7-i*0.6} strokeLinecap="round" opacity={.75}/>
      ))}
      {/* Pendão */}
      <path d="M60 18 Q55 10 50 4" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M60 18 Q60 8 60 2" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M60 18 Q65 10 70 4" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Grãos de pólen */}
      {[48,54,60,66,72].map((x,i) => (
        <circle key={i} cx={x} cy={12+i*2} r="1.5" fill="#eab308" opacity=".7"/>
      ))}
    </svg>
  ),

  milho_r1: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 18" stroke="#16a34a" strokeWidth="4.5"/>
      {[95,78,62,46,30].map((y, i) => (
        <path key={i} d={i%2===0
          ? `M60 ${y} Q${38} ${y-10} ${30} ${y-22}`
          : `M60 ${y} Q${82} ${y-8} ${90} ${y-20}`}
          stroke="#16a34a" strokeWidth={7-i*0.8} strokeLinecap="round" opacity={.7}/>
      ))}
      {/* Espiga com cabelo (silk) */}
      <rect x="70" y="65" width="18" height="34" rx="6" fill={cor} opacity=".85"/>
      {/* Palha */}
      <path d="M70 65 Q65 58 70 52" stroke="#16a34a" strokeWidth="3" strokeLinecap="round"/>
      {/* Silk (cabelo) */}
      {[72,75,78,81,84].map((x, i) => (
        <path key={i} d={`M${x} 65 Q${x-4+i} 52 ${x-6+i*2} 44`}
          stroke={cor} strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
      ))}
      {/* Pendão */}
      <path d="M60 18 Q56 10 52 4" stroke="#eab308" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
      <path d="M60 18 L60 3" stroke="#eab308" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
      <path d="M60 18 Q64 10 68 4" stroke="#eab308" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
    </svg>
  ),

  milho_r3: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 22" stroke="#a3e635" strokeWidth="4"/>
      {[90,73,56].map((y, i) => (
        <path key={i} d={i%2===0 ? `M60 ${y} Q38 ${y-10} 28 ${y-24}` : `M60 ${y} Q82 ${y-8} 92 ${y-22}`}
          stroke="#a3e635" strokeWidth={8-i} strokeLinecap="round" opacity={.7}/>
      ))}
      {/* Espiga em formação */}
      <rect x="68" y="60" width="24" height="40" rx="8" fill={cor} opacity=".9"/>
      {/* Fileiras de grão */}
      {[66,70,74,78,82,86,90,94].map((y,i) => (
        <g key={i}>
          <ellipse cx="74" cy={y} rx="3.5" ry="2.5" fill="#fbbf24" opacity={.7}/>
          <ellipse cx="80" cy={y} rx="3.5" ry="2.5" fill="#fbbf24" opacity={.7}/>
          <ellipse cx="86" cy={y} rx="3.5" ry="2.5" fill="#fbbf24" opacity={.7}/>
        </g>
      ))}
    </svg>
  ),

  // ── ALGODÃO ──────────────────────────────────────────────────────────────
  algodao_b1: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 40" stroke="#16a34a" strokeWidth="3.5"/>
      {[95,80,66,52].map((y,i) => (
        <g key={i}>
          <path d={i%2===0 ? `M60 ${y} Q40 ${y-5} 30 ${y-15}` : `M60 ${y} Q80 ${y-5} 90 ${y-15}`}
            stroke="#16a34a" strokeWidth="2" opacity=".7"/>
          {/* Folha palmatiforme algodão */}
          <path d={i%2===0
            ? `M60 ${y} Q50 ${y-12} 38 ${y-8} Q42 ${y+2} 60 ${y}`
            : `M60 ${y} Q70 ${y-12} 82 ${y-8} Q78 ${y+2} 60 ${y}`}
            fill="#16a34a" opacity=".65"/>
        </g>
      ))}
      {/* Botão quadrado */}
      <rect x="52" y="36" width="16" height="16" rx="2" fill={cor} opacity=".9" transform="rotate(45 60 44)"/>
    </svg>
  ),

  algodao_f1: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 30" stroke="#16a34a" strokeWidth="3.5"/>
      {[95,76,58,42].map((y,i) => (
        <path key={i} d={i%2===0
          ? `M60 ${y} Q42 ${y-14} 34 ${y-8} Q40 ${y+4} 60 ${y}`
          : `M60 ${y} Q78 ${y-14} 86 ${y-8} Q80 ${y+4} 60 ${y}`}
          fill="#16a34a" opacity=".6"/>
      ))}
      {/* Flor aberta */}
      {[0,72,144,216,288].map((a,i) => (
        <ellipse key={i}
          cx={60 + 14*Math.cos(a*Math.PI/180)}
          cy={35 + 14*Math.sin(a*Math.PI/180)}
          rx="9" ry="5"
          fill={cor} opacity=".85"
          transform={`rotate(${a} ${60+14*Math.cos(a*Math.PI/180)} ${35+14*Math.sin(a*Math.PI/180)})`}/>
      ))}
      <circle cx="60" cy="35" r="6" fill="#eab308" opacity=".9"/>
    </svg>
  ),

  algodao_capulho: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 28" stroke="#a3e635" strokeWidth="3.5"/>
      {[90,72,56].map((y,i) => (
        <path key={i} d={i%2===0
          ? `M60 ${y} Q42 ${y-14} 34 ${y-8} Q40 ${y+4} 60 ${y}`
          : `M60 ${y} Q78 ${y-14} 86 ${y-8} Q80 ${y+4} 60 ${y}`}
          fill="#a3e635" opacity=".55"/>
      ))}
      {/* Capulho aberto com fibra */}
      {[0,72,144,216,288].map((a,i) => (
        <path key={i}
          d={`M60 42 Q${60+18*Math.cos(a*Math.PI/180)} ${42+18*Math.sin(a*Math.PI/180)} ${60+26*Math.cos(a*Math.PI/180)} ${42+26*Math.sin(a*Math.PI/180)}`}
          stroke={cor} strokeWidth="7" strokeLinecap="round" opacity=".8"/>
      ))}
      <circle cx="60" cy="42" r="8" fill={cor} opacity=".95"/>
    </svg>
  ),

  // ── FEIJÃO ────────────────────────────────────────────────────────────────
  feijao_r6: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 40" stroke="#16a34a" strokeWidth="3"/>
      {/* Folhas trifoliadas */}
      {[90,72,55].map((y,i) => (
        <g key={i}>
          <ellipse cx={44} cy={y} rx="12" ry="7" fill="#16a34a" opacity={.7} transform={`rotate(-22 44 ${y})`}/>
          <ellipse cx={76} cy={y-2} rx="12" ry="7" fill="#16a34a" opacity={.7} transform={`rotate(18 76 ${y-2})`}/>
          <ellipse cx="60" cy={y-3} rx="9" ry="5.5" fill="#16a34a" opacity={.75}/>
        </g>
      ))}
      {/* Flores */}
      <circle cx="52" cy="68" r="5" fill={cor} opacity=".9"/>
      <circle cx="68" cy="62" r="5" fill={cor} opacity=".85"/>
      {/* Vagem inicial */}
      <rect x="45" y="78" width="30" height="7" rx="3.5" fill={cor} opacity=".8" transform="rotate(-10 45 78)"/>
    </svg>
  ),

  feijao_r8: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 38" stroke="#a3e635" strokeWidth="3"/>
      {[88,72].map((y,i) => (
        <g key={i}>
          <ellipse cx={44} cy={y} rx="11" ry="6.5" fill="#a3e635" opacity={.6} transform={`rotate(-22 44 ${y})`}/>
          <ellipse cx={76} cy={y-2} rx="11" ry="6.5" fill="#a3e635" opacity={.6} transform={`rotate(18 76 ${y-2})`}/>
        </g>
      ))}
      {/* Muitas vagens cheias */}
      {[80,70,60,50,40].map((y,i) => (
        <g key={i}>
          <rect x={36+i} y={y} width="32" height="9" rx="4.5" fill={cor} opacity={.8} transform={`rotate(${-12+i*6} 36 ${y})`}/>
          {/* Grãos */}
          {[0,1,2].map(j => <circle key={j} cx={42+j*8+i} cy={y+4.5} r="2.5" fill="#7c3aed" opacity=".4"/>)}
        </g>
      ))}
    </svg>
  ),

  // ── GERGELIM ─────────────────────────────────────────────────────────────
  gergelim_r1: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 25" stroke="#16a34a" strokeWidth="3.5"/>
      {/* Folhas opostas */}
      {[95,78,62,46,32].map((y,i) => (
        <g key={i}>
          <ellipse cx="40" cy={y} rx="14" ry="6" fill="#16a34a" opacity={.7} transform={`rotate(-10 40 ${y})`}/>
          <ellipse cx="80" cy={y} rx="14" ry="6" fill="#16a34a" opacity={.7} transform={`rotate(10 80 ${y})`}/>
        </g>
      ))}
      {/* Flores tubulares */}
      <rect x="54" y="30" width="12" height="20" rx="6" fill={cor} opacity=".9"/>
      <rect x="42" y="48" width="10" height="18" rx="5" fill={cor} opacity=".85"/>
      <rect x="68" y="44" width="10" height="18" rx="5" fill={cor} opacity=".85"/>
      {/* Boca da flor */}
      {[0,72,144,216,288].map((a,i) => (
        <ellipse key={i}
          cx={60 + 8*Math.cos(a*Math.PI/180)}
          cy={30 + 8*Math.sin(a*Math.PI/180)}
          rx="4" ry="2.5"
          fill={cor} opacity=".7"/>
      ))}
    </svg>
  ),

  gergelim_r3: (cor: string) => (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="108" width="120" height="32" rx="4" fill="#a16207" opacity=".2"/>
      <path d="M60 108 L60 22" stroke="#a3e635" strokeWidth="3.5"/>
      {[95,78,62,46].map((y,i) => (
        <g key={i}>
          <ellipse cx="40" cy={y} rx="12" ry="5.5" fill="#a3e635" opacity={.65} transform={`rotate(-10 40 ${y})`}/>
          <ellipse cx="80" cy={y} rx="12" ry="5.5" fill="#a3e635" opacity={.65} transform={`rotate(10 80 ${y})`}/>
        </g>
      ))}
      {/* Cápsulas */}
      {[80,65,52,38,26].map((y,i) => (
        <g key={i}>
          <rect x="48" y={y} width="10" height="18" rx="4" fill={cor} opacity={.8} transform={`translate(${i%2===0?-8:8} 0)`}/>
          <rect x="62" y={y+3} width="10" height="18" rx="4" fill={cor} opacity={.75}/>
        </g>
      ))}
    </svg>
  ),
}

// ── Mapeamento cultura → fases com SVG ────────────────────────────────────────
interface FaseGuia {
  id: string
  label: string
  desc: string
  detalhe: string
  diaInicio: number
  diaFim: number
  icon: string
  color: string
  svg: (cor: string) => React.ReactElement
  observar: string[]   // lista de pontos de observação
  alerta?: string      // ponto de atenção crítico
}

const GUIA: Record<CulturaType, FaseGuia[]> = {
  soja: [
    { id:'VE', label:'VE', desc:'Emergência', detalhe:'Cotiledões acima do solo', diaInicio:0, diaFim:7, icon:'🌱', color:'#86efac',
      svg: SVG.emergencia,
      observar:['Hipocótilo curvado emergindo','Cotiledões verdes e túrgidos','Solo úmido e fofo ao redor'],
      alerta:'Ataques de cupim, lesmas e pássaros neste período são críticos.' },
    { id:'VC', label:'VC', desc:'Cotilédones abertos', detalhe:'Folhas cotiledonares expandidas', diaInicio:7, diaFim:14, icon:'🌿', color:'#4ade80',
      svg: SVG.soja_vc,
      observar:['Dois cotilédones verdes expandidos','Epicótilo crescendo acima','1ª folha simples surgindo'],
      alerta:'Monitorar tombamento (Rhizoctonia, Pythium).' },
    { id:'V2', label:'V2–V4', desc:'Estágio vegetativo', detalhe:'2 a 4 folhas trifolioladas', diaInicio:14, diaFim:38, icon:'🌿', color:'#22c55e',
      svg: SVG.soja_v2,
      observar:['Folhas trifolioladas completamente expandidas','Nódulos radiculares com bactérias','Pecíolos eretos e firmes'],
      alerta:'Fase crítica para controle de plantas daninhas — janela de capina.' },
    { id:'R1', label:'R1–R2', desc:'Florescimento', detalhe:'Flores abertas nos nós', diaInicio:38, diaFim:60, icon:'🌸', color:'#f472b6',
      svg: SVG.soja_r1,
      observar:['Flores brancas ou roxas abertas','Polinização ocorre no mesmo dia','Alta demanda hídrica — verificar solo'],
      alerta:'Estresse hídrico no florescimento reduz drasticamente a produção.' },
    { id:'R3', label:'R3–R4', desc:'Frutificação', detalhe:'Vagens se formando', diaInicio:60, diaFim:82, icon:'🫘', color:'#fb923c',
      svg: SVG.soja_r3,
      observar:['Vagens verdes nos nós superiores','Flores caídas — normal','Tamanho das vagens crescendo'],
      alerta:'Lagartas e percevejos atacam as vagens nesta fase.' },
    { id:'R5', label:'R5–R6', desc:'Enchimento de grãos', detalhe:'Grãos se formando nas vagens', diaInicio:82, diaFim:105, icon:'⚪', color:'#facc15',
      svg: SVG.soja_r5,
      observar:['Grãos visíveis ao apertar a vagem','Vagens e folhas ainda verdes','Alta demanda de potássio'],
      alerta:'Percevejo na fase de grão cheio é a principal causa de perda de qualidade.' },
    { id:'R7', label:'R7–R8', desc:'Maturação', detalhe:'Vagens amadurecendo', diaInicio:105, diaFim:120, icon:'🟤', color:'#a16207',
      svg: SVG.soja_r7,
      observar:['Folhas amarelas e caindo','Vagens marrons e secas','Grãos duros e amarelos/verdes'],
      alerta:'Aguardar umidade ≤ 13% para colheita. Chuvas podem causar germinação.' },
  ],
  milho: [
    { id:'VE', label:'VE', desc:'Emergência', detalhe:'Coleóptilo emerge do solo', diaInicio:0, diaFim:8, icon:'🌱', color:'#86efac',
      svg: SVG.emergencia,
      observar:['Coleóptilo (bainha) branco emergindo','Solo solto acima da plântula','Raiz seminal ativa'],
      alerta:'Pragas de solo (lagarta elasmo, cupim, broca da raiz) atacam aqui.' },
    { id:'V3', label:'V3–V6', desc:'Vegetativo inicial', detalhe:'3 a 6 folhas com colar', diaInicio:8, diaFim:42, icon:'🌿', color:'#22c55e',
      svg: SVG.milho_v3,
      observar:['Folhas com colar (lígula) visível','Planta de 30–60 cm','Ponto de crescimento ainda abaixo do solo até V5'],
      alerta:'Lagarta do cartucho (Spodoptera) ataca o cartucho — verificar folhas enroladas.' },
    { id:'V10', label:'V7–V10', desc:'Vegetativo acelerado', detalhe:'7 a 10 folhas — crescimento rápido', diaInicio:42, diaFim:58, icon:'🌿', color:'#16a34a',
      svg: SVG.milho_v3,
      observar:['Planta de 1–1,5 m','Internódios alongando rapidamente','Pendão diferenciado internamente'],
      alerta:'Estresse hídrico entre V6–V10 reduz número de grãos por espiga.' },
    { id:'VT', label:'VT', desc:'Pendoamento', detalhe:'Pendão exposto liberando pólen', diaInicio:58, diaFim:68, icon:'🌾', color:'#a3e635',
      svg: SVG.milho_vt,
      observar:['Pendão completamente exposto','Nuvem de pólen ao sacudir a planta','Duração de 5–8 dias'],
      alerta:'Alta temperatura (>35°C) e seca durante o pendoamento prejudicam a polinização.' },
    { id:'R1', label:'R1', desc:'Silkagem / Espigamento', detalhe:'Estilos-estigmas visíveis', diaInicio:68, diaFim:75, icon:'🌽', color:'#fbbf24',
      svg: SVG.milho_r1,
      observar:['Cabelos (silk) verde-amarelados saindo','Polinização: 1 grão de pólen por silk','Espiga protegida pela palha'],
      alerta:'Fase mais crítica: estresse de qualquer natureza aqui = perda grave.' },
    { id:'R3', label:'R2–R4', desc:'Formação do grão', detalhe:'Grão leitoso a farináceo', diaInicio:75, diaFim:108, icon:'🌽', color:'#f97316',
      svg: SVG.milho_r3,
      observar:['Grão branco (R2) → pastoso (R3) → farináceo (R4)','Linha do leite visível ao cortar o grão','Seca dos cabelos'],
      alerta:'Percevejos no R3–R4 causam chochamento de grãos.' },
    { id:'R5', label:'R5–R6', desc:'Maturação fisiológica', detalhe:'Camada negra formada', diaInicio:108, diaFim:120, icon:'🚜', color:'#92400e',
      svg: SVG.colheita,
      observar:['Camada negra (preta) na base do grão','Palha seca e palha do pendão caída','Umidade do grão ~35% — aguardar seca'],
      alerta:'Aguardar umidade ≤ 14% para colheita mecânica.' },
  ],
  milho_safrinha: [
    { id:'VE', label:'VE', desc:'Emergência', detalhe:'Coleóptilo emerge — frio pode atrasar', diaInicio:0, diaFim:10, icon:'🌱', color:'#86efac',
      svg: SVG.emergencia,
      observar:['Emergência mais lenta pelo frio','Verificar stand de plantas','Temperatura do solo idealmente > 12°C'],
      alerta:'Geadas tardias podem matar plântulas jovens.' },
    { id:'V3', label:'V3–V6', desc:'Vegetativo inicial', detalhe:'3 a 6 folhas', diaInicio:10, diaFim:48, icon:'🌿', color:'#22c55e',
      svg: SVG.milho_v3,
      observar:['Crescimento mais lento que milho verão','Folhas com eventual amarelecimento por frio','Raízes nodais em formação'],
      alerta:'Tombamento e fungos de solo são mais frequentes no frio.' },
    { id:'VT', label:'VT', desc:'Pendoamento', detalhe:'Pólen liberado — risco de frio', diaInicio:62, diaFim:72, icon:'🌾', color:'#a3e635',
      svg: SVG.milho_vt,
      observar:['Verificar sincronia entre pendão e silk','Temperaturas noturnas abaixo de 10°C prejudicam','Polinização reduzida no frio'],
      alerta:'Geadas durante o pendoamento = perda total da lavoura.' },
    { id:'R1', label:'R1', desc:'Espigamento', detalhe:'Silk visível — polinização crítica', diaInicio:72, diaFim:80, icon:'🌽', color:'#fbbf24',
      svg: SVG.milho_r1,
      observar:['Mesmos indicadores do milho verão','Mais sensível ao frio nesta fase','Monitorar espiga com palha bem fechada'],
      alerta:'Qualquer estresse aqui é multiplicado em perda de produção.' },
    { id:'R3', label:'R3–R4', desc:'Formação do grão', detalhe:'Grão pastoso a farináceo', diaInicio:80, diaFim:100, icon:'🌽', color:'#f97316',
      svg: SVG.milho_r3,
      observar:['Grain fill mais lento pelo frio','Linha do leite descendo','Palha amarelando'],
      alerta:'Frio severo no grain fill reduz peso de grão.' },
    { id:'R5', label:'R5', desc:'Maturação', detalhe:'Camada negra — pronto para colheita', diaInicio:100, diaFim:115, icon:'🚜', color:'#92400e',
      svg: SVG.colheita,
      observar:['Camada negra formada na base do grão','Palha do pendão seca e tombada','Lavoura pronta para colheita'],
      alerta:'Colher antes de chuvas para evitar deterioração.' },
  ],
  algodao: [
    { id:'VE', label:'VE', desc:'Emergência', detalhe:'Hipocótilo curvo emerge', diaInicio:0, diaFim:7, icon:'🌱', color:'#86efac',
      svg: SVG.emergencia,
      observar:['Cotilédones arredondados e verdes','Solo solto ao redor','Profundidade ideal de semeadura: 3–5 cm'],
      alerta:'Percevejo castanho e cupins são pragas iniciais graves.' },
    { id:'V2', label:'V1–V5', desc:'Vegetativo inicial', detalhe:'Folhas verdadeiras se expandindo', diaInicio:7, diaFim:25, icon:'🌿', color:'#22c55e',
      svg: SVG.milho_v3,
      observar:['Folhas palmatifórmis (em forma de mão)','Crescimento apical ativo','Sistema radicular profundizando'],
      alerta:'Bicudo-do-algodoeiro pode atacar botões em formação.' },
    { id:'B1', label:'B1', desc:'Primeiro botão floral', detalhe:'Quadrado (botão) visível no 1º ramo', diaInicio:25, diaFim:50, icon:'🔲', color:'#a78bfa',
      svg: SVG.algodao_b1,
      observar:['Botão piramidal (quadrado) no 1º ramo frutífero','Planta com 5–8 folhas','Marco: conta o período de 60 dias até colheita'],
      alerta:'Bicudo faz orifício circular no botão — verificar queda de botões.' },
    { id:'F1', label:'F1', desc:'Primeira flor', detalhe:'Flor aberta no 1º ramo', diaInicio:50, diaFim:70, icon:'🌸', color:'#c084fc',
      svg: SVG.algodao_f1,
      observar:['Pétalas brancas (manhã) → rosa (tarde) → caem','Florescimento sobe na planta ao longo de semanas','Flor vive apenas 1 dia'],
      alerta:'Período de formação de maçãs — controlar pragas intensamente.' },
    { id:'C1', label:'C1', desc:'Primeiro capulho', detalhe:'Maçã jovem em formação', diaInicio:70, diaFim:100, icon:'🟢', color:'#34d399',
      svg: SVG.algodao_b1,
      observar:['Capulho verde com 5 lóculos visíveis','Tamanho cresce diariamente','Pesar capulhos para avaliar enchimento'],
      alerta:'Helicoverpa armigera é a principal praga nesta fase.' },
    { id:'MA', label:'Maçã', desc:'Maçãs em plena formação', detalhe:'Capulhos verdes grandes', diaInicio:100, diaFim:130, icon:'🟡', color:'#fbbf24',
      svg: SVG.algodao_b1,
      observar:['Capulhos grandes, firmes e verdes','Planta carregada — verificar sustentação','Desfolha natural das folhas baixeiras'],
      alerta:'Ramulose e mancha-de-ramulária podem devastar lavoura.' },
    { id:'AB', label:'AB', desc:'Abertura de capulhos', detalhe:'Fibra branca aparecendo', diaInicio:130, diaFim:155, icon:'🔶', color:'#fb923c',
      svg: SVG.algodao_capulho,
      observar:['Capulhos abrindo com pluma branca','Desfolha natural acelerada','Monitorar % de abertura'],
      alerta:'Iniciar planejamento de desfolha química para uniformizar abertura.' },
    { id:'CO', label:'Col.', desc:'Colheita', detalhe:'60–70% dos capulhos abertos', diaInicio:155, diaFim:170, icon:'🚜', color:'#92400e',
      svg: SVG.colheita,
      observar:['Maioria dos capulhos abertos','Pluma seca e fofa','Hastes completamente secas'],
      alerta:'Colher antes das chuvas para manter qualidade da fibra (UHML e uniformidade).' },
  ],
  feijao: [
    { id:'VE', label:'VE', desc:'Emergência', detalhe:'Arco de emergência visível', diaInicio:0, diaFim:6, icon:'🌱', color:'#86efac',
      svg: SVG.emergencia,
      observar:['Hipocótilo curvado emergindo','Cotilédones verdes e túrgidos','Stand uniforme no campo'],
      alerta:'Lesmas e pássaros consomem plântulas de feijão rapidamente.' },
    { id:'V2', label:'V1–V4', desc:'Vegetativo', detalhe:'1ª folha trifoliolada', diaInicio:6, diaFim:20, icon:'🌿', color:'#22c55e',
      svg: SVG.soja_v2,
      observar:['Folha trifoliolada completamente expandida','Nódulos rosados nas raízes (fix. N)','Crescimento apical ativo'],
      alerta:'Vaquinha (Diabrotica) destrói folhas em V1–V4.' },
    { id:'R5', label:'R5', desc:'Pré-florescimento', detalhe:'Botões florais formados', diaInicio:20, diaFim:33, icon:'🌸', color:'#f9a8d4',
      svg: SVG.feijao_r6,
      observar:['Botões florais brancos/roxos em todos os nós','Planta com 40–60 cm','Irrigar se necessário'],
      alerta:'Seca no pré-florescimento reduz número de flores.' },
    { id:'R6', label:'R6', desc:'Florescimento', detalhe:'Flores abertas nos nós', diaInicio:33, diaFim:45, icon:'🌸', color:'#ec4899',
      svg: SVG.feijao_r6,
      observar:['Flores brancas/roxas/rosas abertas','Polinização autógama (própria flor)','Temperatura ideal 15–30°C'],
      alerta:'Temperatura noturna < 12°C ou > 32°C causa aborto de flores.' },
    { id:'R7', label:'R7', desc:'Formação de vagens', detalhe:'Vagens com 2,5 cm', diaInicio:45, diaFim:60, icon:'🫘', color:'#fb923c',
      svg: SVG.feijao_r8,
      observar:['Vagens jovens verdes nos nós','Flores caídas — normal','Flores mortas indicam sucesso de fecundação'],
      alerta:'Mosca-branca e pulgão podem transmitir vírus nesta fase.' },
    { id:'R8', label:'R8', desc:'Enchimento de grãos', detalhe:'Grãos crescendo nas vagens', diaInicio:60, diaFim:78, icon:'🫘', color:'#f97316',
      svg: SVG.feijao_r8,
      observar:['Grãos visíveis ao apertar a vagem','Vagens verdes e cheias','Demandam umidade constante'],
      alerta:'Carências de potássio e magnésio afetam qualidade do grão.' },
    { id:'R9', label:'R9', desc:'Maturação / Colheita', detalhe:'Vagens secas e amarelas', diaInicio:78, diaFim:95, icon:'🚜', color:'#92400e',
      svg: SVG.colheita,
      observar:['90% das vagens amareladas ou marrons','Grãos duros e coloridos','Hastes e folhas secas caindo'],
      alerta:'Colher antes de 14% de umidade. Chuvas causam chochamento.' },
  ],
  gergelim: [
    { id:'VE', label:'VE', desc:'Emergência', detalhe:'Plântulas pequenas emergindo', diaInicio:0, diaFim:7, icon:'🌱', color:'#86efac',
      svg: SVG.emergencia,
      observar:['Cotilédones minúsculos mas visíveis','Solo deve estar bem preparado','Semeadura rasa: 2–3 cm'],
      alerta:'Gergelim é muito sensível ao excesso de água nesta fase.' },
    { id:'V2', label:'V1–V4', desc:'Vegetativo inicial', detalhe:'Folhas opostas se expandindo', diaInicio:7, diaFim:22, icon:'🌿', color:'#4ade80',
      svg: SVG.milho_v3,
      observar:['Folhas opostas simples ovais','Crescimento lento — 2–3 cm/dia','Raiz pivotante se aprofundando'],
      alerta:'Excesso de umidade causa tombamento e podridão de raiz.' },
    { id:'V4', label:'V4+', desc:'Vegetativo pleno', detalhe:'Crescimento acelerado em altura', diaInicio:22, diaFim:38, icon:'🌿', color:'#16a34a',
      svg: SVG.gergelim_r1,
      observar:['Planta de 40–80 cm','Entrenós se alongando rapidamente','Folhas superiores menores e mais estreitas'],
      alerta:'Fase de maior demanda hídrica antes do florescimento.' },
    { id:'R1', label:'R1', desc:'Início do florescimento', detalhe:'Flores tubulares brancas/lilás', diaInicio:38, diaFim:52, icon:'🌸', color:'#c084fc',
      svg: SVG.gergelim_r1,
      observar:['Flores campanuladas (tubo) nos internódios','Brancas, rosa ou roxas conforme variedade','Polinização por abelhas — preservar'],
      alerta:'Broca da haste (Euzophera) pode atacar internódios nesta fase.' },
    { id:'R2', label:'R2', desc:'Florescimento pleno', detalhe:'Flores em todos os internódios', diaInicio:52, diaFim:65, icon:'🌸', color:'#a855f7',
      svg: SVG.gergelim_r1,
      observar:['Flores abundantes do baixeiro ao topo','Cápsulas jovens nos internódios inferiores','Folhas velhas começam a cair'],
      alerta:'Lesma-da-cápsula pode perfurar as cápsulas jovens.' },
    { id:'R3', label:'R3', desc:'Formação de cápsulas', detalhe:'Cápsulas verdes se desenvolvendo', diaInicio:65, diaFim:82, icon:'🔵', color:'#38bdf8',
      svg: SVG.gergelim_r3,
      observar:['Cápsulas alongadas e verdes','Cada cápsula contém 60–100 sementes','Linha do cálice visível'],
      alerta:'Broca da cápsula (Laspeyresia) — verificar orifícios nas cápsulas.' },
    { id:'R4', label:'R4', desc:'Maturação / Colheita', detalhe:'Cápsulas amarelando — deiscência iminente', diaInicio:82, diaFim:105, icon:'🚜', color:'#92400e',
      svg: SVG.colheita,
      observar:['Cápsulas inferiores amareladas','Folhas secas e caindo','Casca da planta começando a secar'],
      alerta:'Colher antes de 30% de deiscência (abertura das cápsulas) para evitar perdas.' },
  ],
}

// ── Labels ────────────────────────────────────────────────────────────────────
const CULTURA_LABELS: Record<CulturaType, string> = {
  soja:'Soja', milho:'Milho', milho_safrinha:'Milho Safrinha',
  gergelim:'Gergelim', feijao:'Feijão', algodao:'Algodão',
}

// ── Componente principal ──────────────────────────────────────────────────────
interface FenologiaGuiaProps {
  cultura: CulturaType
  faseAtualIdx?: number   // índice da fase esperada hoje (para destaque)
  onClose: () => void
}

export function FenologiaGuia({ cultura, faseAtualIdx, onClose }: FenologiaGuiaProps) {
  const fases = GUIA[cultura] ?? []
  const [selecionado, setSelecionado] = useState(faseAtualIdx ?? 0)
  const fase = fases[selecionado]

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal */}
      <div
        className="flex flex-col m-auto w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          maxHeight: '92dvh',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--borda)', flexShrink: 0 }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: 'var(--fg)' }}>
              📖 Guia Fenológico — {CULTURA_LABELS[cultura]}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              {fases.length} estágios · toque em cada fase para ver detalhes
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg)', border: '1px solid var(--borda)' }}>
            <X size={15} style={{ color: 'var(--fg-muted)' }} />
          </button>
        </div>

        {/* Lista de miniaturas (scroll horizontal) */}
        <div className="overflow-x-auto px-4 py-3" style={{ flexShrink: 0, borderBottom: '1px solid var(--borda)' }}>
          <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
            {fases.map((f, i) => {
              const isAtual    = i === faseAtualIdx
              const isSelecionado = i === selecionado
              return (
                <button key={f.id} onClick={() => setSelecionado(i)}
                  className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all"
                  style={{
                    minWidth: 72,
                    background: isSelecionado ? `${f.color}18` : 'transparent',
                    border: isSelecionado ? `2px solid ${f.color}` : '2px solid transparent',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {isAtual && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-white flex items-center justify-center"
                      style={{ background: '#16a34a', fontSize: 7, fontWeight: 800, lineHeight: 1 }}>
                      ✓
                    </div>
                  )}
                  {/* Miniatura SVG */}
                  <div style={{ width: 52, height: 60, flexShrink: 0 }}>
                    {f.svg(f.color)}
                  </div>
                  <span className="text-[10px] font-bold text-center" style={{ color: isSelecionado ? f.color : 'var(--fg-muted)' }}>
                    {f.label}
                  </span>
                  <span className="text-[9px] text-center leading-tight" style={{ color: 'var(--fg-subtle)', maxWidth: 64 }}>
                    D{f.diaInicio}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detalhe da fase selecionada */}
        {fase && (
          <div className="overflow-y-auto flex-1 p-5">

            {/* Navegação anterior / próximo */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setSelecionado(v => Math.max(0, v-1))}
                disabled={selecionado === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--bg)', border: '1px solid var(--borda)', color: 'var(--fg-muted)',
                  opacity: selecionado === 0 ? 0.35 : 1 }}>
                <ChevronLeft size={13} /> Anterior
              </button>
              <span className="text-xs font-semibold" style={{ color: 'var(--fg-subtle)' }}>
                {selecionado + 1} / {fases.length}
              </span>
              <button onClick={() => setSelecionado(v => Math.min(fases.length-1, v+1))}
                disabled={selecionado === fases.length - 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--bg)', border: '1px solid var(--borda)', color: 'var(--fg-muted)',
                  opacity: selecionado === fases.length-1 ? 0.35 : 1 }}>
                Próximo <ChevronRight size={13} />
              </button>
            </div>

            {/* Ilustração grande + info */}
            <div className="flex gap-5 mb-5">
              {/* Ilustração */}
              <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ width: 140, height: 160, background: `${fase.color}14`, border: `1.5px solid ${fase.color}35` }}>
                <div style={{ width: 120, height: 140 }}>
                  {fase.svg(fase.color)}
                </div>
              </div>

              {/* Badge + info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xl">{fase.icon}</span>
                  <span className="font-bold text-lg" style={{ color: fase.color }}>{fase.label}</span>
                  {selecionado === faseAtualIdx && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#16a34a22', color: '#16a34a', border: '1px solid #16a34a55' }}>
                      ● Fase atual
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--fg)' }}>{fase.desc}</p>
                <p className="text-xs mb-3" style={{ color: 'var(--fg-muted)' }}>{fase.detalhe}</p>
                <div className="flex gap-3 text-xs">
                  <div className="px-3 py-1.5 rounded-lg"
                    style={{ background: `${fase.color}14`, color: fase.color, fontWeight: 700 }}>
                    📅 Dia {fase.diaInicio}–{fase.diaFim}
                  </div>
                  <div className="px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg)', border: '1px solid var(--borda)', color: 'var(--fg-muted)' }}>
                    ⏱ {fase.diaFim - fase.diaInicio} dias
                  </div>
                </div>
              </div>
            </div>

            {/* O que observar */}
            <div className="rounded-xl p-4 mb-3"
              style={{ background: `${fase.color}0e`, border: `1px solid ${fase.color}30` }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-3"
                style={{ color: fase.color, letterSpacing: '0.07em' }}>
                🔍 O que observar no campo
              </p>
              <ul className="space-y-2">
                {fase.observar.map((obs, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--fg)' }}>
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: fase.color, color: 'white' }}>{i+1}</span>
                    {obs}
                  </li>
                ))}
              </ul>
            </div>

            {/* Alerta */}
            {fase.alerta && (
              <div className="rounded-xl p-4 flex gap-3"
                style={{ background: '#fef3c7', border: '1px solid #fbbf24' }}>
                <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: '#92400e' }}>Ponto de atenção</p>
                  <p className="text-xs" style={{ color: '#78350f' }}>{fase.alerta}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
