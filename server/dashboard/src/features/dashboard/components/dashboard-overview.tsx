"use client";

/**
 * 仪表盘主页。
 *
 * 自维护 fork 新增。
 * 五项指标 + 六个面板，数据来自 useDashboardData（一次请求，多面板共享）。
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Database,
  Gauge,
  RefreshCw,
  Timer,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Chart } from "./chart";
import { PanelWrapper } from "./panel-wrapper";
import { StatCard } from "./stat-card";
import { SectionPageLayout } from "./section-page-layout";
import {
  buildAreaSpec,
  buildPieSpec,
  buildRankBarSpec,
  type ChartTheme,
} from "../lib/chart-specs";
import {
  DEFAULT_TIME_RANGE,
  TIME_RANGE_PRESETS,
  presetDays,
  resolveRange,
  type TimeRangePresetKey,
} from "../lib/time-range";
import { useDashboardData } from "../lib/use-dashboard-data";
import { useTheme } from "next-themes";

const STORAGE_KEY = "dashboard_time_range";

/** 读上次选择的时间范围（带类型校验，非法值回落默认）。 */
function readStoredRange(): TimeRangePresetKey {
  if (typeof window === "undefined") return DEFAULT_TIME_RANGE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && TIME_RANGE_PRESETS.some((p) => p.key === raw)) {
      return raw as TimeRangePresetKey;
    }
  } catch {
    // localStorage 被禁用时静默回落
  }
  return DEFAULT_TIME_RANGE;
}

export function DashboardOverview() {
  const { t } = useTranslation("dashboard");
  const { resolvedTheme } = useTheme();

  const [preset, setPreset] = React.useState<TimeRangePresetKey>(DEFAULT_TIME_RANGE);

  // localStorage 只能在客户端读，挂载后再同步，避免 hydration 不一致
  React.useEffect(() => {
    setPreset(readStoredRange());
  }, []);

  const selectPreset = React.useCallback((next: TimeRangePresetKey) => {
    setPreset(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 忽略：写失败只影响下次默认值
    }
  }, []);

  const days = presetDays(preset);
  // end 固定为「现在」，但它每次渲染都会变 —— 用 preset 作为依赖，
  // 避免每次渲染都重新聚合。
  const range = React.useMemo(() => resolveRange(preset), [preset]);
  // 注意：变量名不能叫 window，否则会遮蔽全局的 window（localStorage 等）
  const timeWindow = React.useMemo(
    () => ({ start: range.start, end: range.end }),
    [range],
  );

  const { summary, loading, error, reload } = useDashboardData(timeWindow, days);
  const theme: ChartTheme = resolvedTheme === "dark" ? "dark" : "light";

  const formatNumber = React.useCallback(
    (value: number) => value.toLocaleString(),
    [],
  );
  const formatPercent = React.useCallback(
    (value: number) => `${(value * 100).toFixed(value === 0 ? 0 : 1)}%`,
    [],
  );
  const formatLatency = React.useCallback(
    (value: number) => `${value.toFixed(0)} ${t("unit.ms")}`,
    [t],
  );

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t("title")}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {/* 时间范围：预设按钮，存 localStorage */}
        <div className="flex items-center rounded-lg border border-memBorder-primary p-0.5">
          {TIME_RANGE_PRESETS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => selectPreset(item.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                preset === item.key
                  ? "bg-surface-default-secondary font-medium text-onSurface-default-primary"
                  : "text-onSurface-default-secondary hover:text-onSurface-default-primary",
              )}
            >
              {t(`range.${item.key}`)}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
          {loading ? t("refreshing") : t("refresh")}
        </Button>
      </SectionPageLayout.Actions>

      <SectionPageLayout.Content>
        <div className="space-y-4 pb-6">
          {/* 五项指标 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              title={t("metrics.memories")}
              description={t("metrics.memoriesDesc")}
              value={formatNumber(summary?.memoryCount ?? 0)}
              icon={Database}
              tone="brand"
              loading={loading}
              error={error}
              sparkline={summary?.writeTrend.map((p) => p.count)}
            />
            <StatCard
              title={t("metrics.entities")}
              description={t("metrics.entitiesDesc")}
              value={formatNumber(summary?.entityCount ?? 0)}
              icon={Users}
              tone="info"
              loading={loading}
              error={error}
            />
            <StatCard
              title={t("metrics.requests")}
              description={t("metrics.requestsDesc")}
              value={formatNumber(summary?.requestStats.total ?? 0)}
              icon={Activity}
              tone="brand"
              loading={loading}
              error={error}
            />
            <StatCard
              title={t("metrics.errorRate")}
              description={t("metrics.errorRateDesc")}
              value={formatPercent(summary?.requestStats.errorRate ?? 0)}
              icon={TriangleAlert}
              tone="positive"
              loading={loading}
              error={error}
              details={
                summary === null
                  ? undefined
                  : [
                      { label: t("metrics.requests"), value: summary.requestStats.errors },
                    ]
              }
            />
            <StatCard
              title={t("metrics.avgLatency")}
              description={t("metrics.avgLatencyDesc")}
              value={formatLatency(summary?.requestStats.avgLatencyMs ?? 0)}
              icon={Timer}
              tone="info"
              loading={loading}
              error={error}
              details={
                summary === null
                  ? undefined
                  : [{ label: "max", value: formatLatency(summary.requestStats.maxLatencyMs) }]
              }
            />
          </div>

          {/* 图表区 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PanelWrapper
              title={t("panels.writeTrend.title")}
              description={t("panels.writeTrend.description")}
              loading={loading}
              empty={!loading && (summary?.writeTrend.length ?? 0) === 0}
              emptyMessage={t("empty.noTrend")}
              height="h-64"
              contentClassName="p-4 sm:p-5"
            >
              <Chart
                spec={buildAreaSpec(summary?.writeTrend ?? [], theme, t("chart.count"))}
                className="h-64"
              />
            </PanelWrapper>

            <PanelWrapper
              title={t("panels.category.title")}
              description={t("panels.category.description")}
              loading={loading}
              empty={!loading && (summary?.categoryBuckets.length ?? 0) === 0}
              emptyMessage={t("empty.noMemories")}
              contentClassName="p-4 sm:p-5"
            >
              <Chart
                spec={buildPieSpec(
                  summary?.categoryBuckets ?? [],
                  theme,
                  undefined,
                  t("chart.count"),
                )}
                className="h-64"
              />
            </PanelWrapper>

            <PanelWrapper
              title={t("panels.requestRank.title")}
              description={t("panels.requestRank.description")}
              loading={loading}
              empty={!loading && (summary?.requestPathBuckets.length ?? 0) === 0}
              emptyMessage={t("empty.noRequests")}
              contentClassName="p-4 sm:p-5"
            >
              <Chart
                spec={buildRankBarSpec(
                  (summary?.requestPathBuckets ?? []).slice(0, 8),
                  theme,
                )}
                className="h-64"
              />
            </PanelWrapper>

            <PanelWrapper
              title={t("panels.entities.title")}
              description={t("panels.entities.description")}
              loading={loading}
              empty={!loading && (summary?.entityCount ?? 0) === 0}
              emptyMessage={t("empty.noMemories")}
              contentClassName="p-4 sm:p-5"
            >
              <div className="h-64 space-y-2 overflow-auto">
                {(summary?.entities ?? []).map((entity) => (
                  <div
                    key={`${entity.type}:${entity.id}`}
                    className="flex items-center justify-between rounded-lg border border-memBorder-primary px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-onSurface-default-primary">
                        {entity.id}
                      </div>
                      <div className="text-xs text-onSurface-default-tertiary">
                        {entity.type}
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-sm tabular-nums text-onSurface-default-secondary">
                      {formatNumber(entity.total_memories)}
                    </div>
                  </div>
                ))}
              </div>
            </PanelWrapper>
          </div>

          {/* 最近活动 + 响应状态 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <PanelWrapper
              title={t("panels.recent.title")}
              description={t("panels.recent.description")}
              loading={loading}
              empty={!loading && (summary?.recentMemories.length ?? 0) === 0}
              emptyMessage={
                <div className="text-center">
                  <div>{t("empty.noMemories")}</div>
                  <div className="mt-1 text-xs text-onSurface-default-tertiary">
                    {t("empty.noMemoriesHint")}
                  </div>
                </div>
              }
              contentClassName="p-4 sm:p-5"
            >
              <div className="max-h-64 space-y-2 overflow-auto">
                {(summary?.recentMemories ?? []).map((memory) => (
                  <div
                    key={memory.id}
                    className="rounded-lg border border-memBorder-primary px-3 py-2"
                  >
                    <div className="text-sm text-onSurface-default-primary">
                      {memory.memory}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-onSurface-default-tertiary">
                      {memory.created_at ? (
                        <span>{new Date(memory.created_at).toLocaleString()}</span>
                      ) : null}
                      {typeof memory.metadata?.category === "string" ? (
                        <span>{memory.metadata.category}</span>
                      ) : null}
                      {typeof memory.metadata?.scope === "string" ? (
                        <span>{memory.metadata.scope}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </PanelWrapper>

            <PanelWrapper
              title={t("panels.requestStatus.title")}
              description={t("panels.requestStatus.description")}
              loading={loading}
              empty={!loading && (summary?.requestStatusBuckets.length ?? 0) === 0}
              emptyMessage={t("empty.noRequests")}
              contentClassName="p-4 sm:p-5"
            >
              <div className="max-h-64 space-y-2 overflow-auto">
                {(summary?.requestStatusBuckets ?? []).map((bucket) => {
                  const code = Number(bucket.key);
                  const ok = code >= 200 && code < 300;
                  return (
                    <div
                      key={bucket.key}
                      className="flex items-center justify-between rounded-lg border border-memBorderPrimary px-3 py-2"
                    >
                      <span
                        className={cn(
                          "font-mono text-sm tabular-nums",
                          ok ? "text-onSurface-positive-primary" : "text-onSurface-danger-primary",
                        )}
                      >
                        {bucket.key}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-onSurface-default-secondary">
                        {formatNumber(bucket.count)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </PanelWrapper>
          </div>

          {/* 加载失败时的提示（错误详情已由 toast 去重后弹出） */}
          {error && !loading ? (
            <div className="flex items-center gap-2 text-xs text-onSurface-default-tertiary">
              <Gauge className="size-3.5" />
              <button type="button" className="underline" onClick={reload}>
                {t("refresh")}
              </button>
            </div>
          ) : null}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  );
}
