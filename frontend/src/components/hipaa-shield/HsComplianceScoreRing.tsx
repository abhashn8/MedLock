"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

export type HsComplianceScoreRingProps = {
  score: number
  label?: string
  className?: string
}

/**
 * Program-level compliance score visualization for Overview.
 */
export function HsComplianceScoreRing({
  score,
  label = "Compliance score",
  className,
}: HsComplianceScoreRingProps) {
  const [progress, setProgress] = useState(0)
  const size = 120
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  const color = useMemo(() => {
    if (score >= 85) return "#16A34A"
    if (score >= 65) return "#D97706"
    return "#DC2626"
  }, [score])

  useEffect(() => {
    const t = requestAnimationFrame(() => setProgress(score))
    return () => cancelAnimationFrame(t)
  }, [score])

  const offset = c - (progress / 100) * c

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={size} height={size} className="block" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#F1F3F7"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 1s ease-out, stroke 150ms ease",
          }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="#111827"
          style={{ fontSize: 28, fontWeight: 600, fontFamily: "inherit" }}
        >
          {Math.round(progress)}
        </text>
      </svg>
      <p className="mt-3 text-hs-secondary font-normal text-hs-muted">{label}</p>
    </div>
  )
}
