"use client";

/**
 * StatCard：仪表盘的指标卡。
 *
 * 自维护 fork 新增。设计参考 new-api 的
 * `features/dashboard/components/ui/stat-card.tsx`，适配点：
 *  - 三个状态（loading / error / 正常）内建，与参考实现一致
 *  - sparkline 用上手写的 SVG（见 lib/sparkline.ts），不依赖图表库
 *  - tone 色带改用本项目的语义色变量，而不是参考实现的自定义 --overview-accent-*
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildBarSparkline,
  buildLineSparkline,
  SPARKLINE_HEIGHT,
  SPARKLINE_WIDTH,
} from "../lib/sparkline";

/** 色带。对应 new-api 的 accent-1/2/3。 */
export type StatCardTone = "brand" | "positive" | "info";

const TONE_TEXT: Record<StatCardTone, string> = {
  brand: "text-onSurface-default-brand",
  positive: "text-onSurface-positive-primary",
  info: "text-onSurface-info-primary",
};

export interface StatCardDetail {
  label: string;
  value: React.ReactNode;
}

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  /** 一句话说明这个指标是什么，避免只有数字看不懂。 */
  description?: string;
  icon?: LucideIcon;
  tone?: StatCardTone;
  /** 趋势数据。给了就渲染 sparkline。 */
  sparkline?: number[];
  sparklineVariant?: "line" | "bars";
  /** 底部的次要指标。 */
  details?: StatCardDetail[];
  loading?: boolean;
  error?: boolean;
}

function LineSparkline({ values, tone }: { values: number[]; tone: StatCardTone }) {
  const rawId = React.useId();
  // useId 会带冒号，不能直接当 SVG id
  const gradientId = `stat-spark-${rawId.replaceAll(":", "")}`;
  const paths = buildLineSparkline(values);

  if (paths === null) return null;

  return (
    <div className={cn("relative h-8 overflow-hidden rounded-lg", TONE_TEXT[tone])} aria-hidden="true">
      <svg viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`} preserveAspectRatio="none" className="size-full">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={paths.areaPath} fill={`url(#${gradientId})`} />
        <path
          d={paths.linePath}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function BarSparkline({ values, tone }: { values: number[]; tone: StatCardTone }) {
  const bars = buildBarSparkline(values);
  if (bars.length === 0) return null;

  return (
    <div className={cn("flex h-8 items-end gap-0.5", TONE_TEXT[tone])} aria-hidden="true">
      {bars.map((bar) => (
        <span
          key={bar.position}
          className="flex-1 rounded-sm bg-current opacity-70"
          style={{ height: `${bar.height}%`, minHeight: bar.height > 0 ? 2 : 0 }}
        />
      ))}
    </div>
  );
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "brand",
  sparkline,
  sparklineVariant = "line",
  details,
  loading = false,
  error = false,
}: StatCardProps) {
  let valueContent: React.ReactNode;
  if (loading) {
    valueContent = <Skeleton className="h-7 w-24" />;
  } else if (error) {
    // 参考实现的做法：错误只显示占位符，真正的报错交给 toast，
    // 避免一排卡片里出现多份同样的错误文案。
    valueContent = (
      <div className="text-2xl font-semibold tabular-nums text-onSurface-default-tertiary">--</div>
    );
  } else {
    valueContent = (
      <div className="font-mono text-2xl font-semibold tabular-nums text-onSurface-default-primary">
        {value}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-memBorder-primary bg-surface-default-primary p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-onSurface-default-secondary">{title}</div>
          <div className="mt-2">{valueContent}</div>
          {description === undefined ? null : (
            <div className="mt-1 truncate text-xs text-onSurface-default-tertiary">{description}</div>
          )}
        </div>
        {Icon === undefined ? null : (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-default-secondary", TONE_TEXT[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>

      {loading || error || !sparkline?.length ? null : (
        <div className="mt-3">
          {sparklineVariant === "bars" ? (
            <BarSparkline values={sparkline} tone={tone} />
          ) : (
            <LineSparkline values={sparkline} tone={tone} />
          )}
        </div>
      )}

      {details?.length ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-memBorder-primary pt-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-baseline gap-1.5">
              <span className="text-xs text-onSurface-default-tertiary">{detail.label}</span>
              <span className="text-xs font-medium tabular-nums text-onSurface-default-secondary">
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
