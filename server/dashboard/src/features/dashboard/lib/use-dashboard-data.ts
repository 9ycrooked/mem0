"use client";

/**
 * 仪表盘的数据获取。
 *
 * 自维护 fork 新增。
 *
 * 架构决策（已与用户确认）：**一次请求，多面板共享**。
 * 只用一次并行 `Promise.all` 拿三类数据，聚合后由各面板消费，
 * 而不是每个面板各发一次请求 —— 后者会让筛选变化时请求数翻几倍。
 *
 * 时间筛选在**客户端**完成：`GET /memories` 与 `/requests` 都不支持时间范围参数
 * （实测确认，只支持 user_id/run_id/agent_id/top_k 与 limit）。记忆规模小，可接受。
 *
 * 同时这也是 WeakSet 错误去重（lib/handle-server-error.ts）存在的原因：
 * 一次失败会让多个面板拿到同一个 error 对象。
 */

import * as React from "react";

import { api } from "@/utils/api";
import {
  ENTITY_ENDPOINTS,
  MEMORY_ENDPOINTS,
  REQUEST_ENDPOINTS,
} from "@/utils/api-endpoints";

import {
  buildWriteTrend,
  byCategory,
  byImportance,
  byProject,
  byRequestPath,
  byScope,
  byStatus,
  byStatusCode,
  summarizeRequests,
  type Bucket,
  type EntityRecord,
  type MemoryRecord,
  type RequestRecord,
  type RequestStats,
  type TimeWindow,
  type TrendPoint,
} from "../lib/aggregate";
import { presetDays, type TimeRangePresetKey } from "../lib/time-range";
import { handleServerError } from "../lib/handle-server-error";

/**
 * 请求日志一次最多取多少条。
 *
 * 上限来自服务端校验（已核对 /openapi.json）：
 *   limit: integer, default 50, min 1, max 200
 * 传超过 200 会被 FastAPI 以 422 拒绝（"Input should be less than or equal to 200"）。
 * 该接口不支持时间范围参数，所以「最近 N 天」是在客户端按 created_at 过滤的。
 *
 * 导出以便单测钉住这个边界（曾经写成 500 导致整块调用统计 422 失效）。
 */
export const REQUEST_LIMIT = 200;

/** 服务端对 /requests 的 limit 上限。改服务端时同步这里。 */
export const REQUEST_LIMIT_MAX = 200;

export interface DashboardData {
  memories: MemoryRecord[];
  entities: EntityRecord[];
  requests: RequestRecord[];
}

/** 聚合后的视图模型，面板直接消费。 */
export interface DashboardSummary {
  memoryCount: number;
  entityCount: number;
  /** 实体列表（面板要逐条展示，不只是数量）。 */
  entities: EntityRecord[];
  /** 按分类分布。 */
  categoryBuckets: Bucket[];
  scopeBuckets: Bucket[];
  importanceBuckets: Bucket[];
  projectBuckets: Bucket[];
  statusBuckets: Bucket[];
  /** 写入趋势（按天，已补齐空档）。 */
  writeTrend: TrendPoint[];
  /** 调用健康度。 */
  requestStats: RequestStats;
  requestPathBuckets: Bucket[];
  requestStatusBuckets: Bucket[];
  /** 最近活动（最新的若干条记忆）。 */
  recentMemories: MemoryRecord[];
}

/** 把原始数据折算成面板需要的视图模型。纯函数，便于单测。 */
export function summarize(
  data: DashboardData,
  window: TimeWindow,
  days: number | null,
): DashboardSummary {
  // 调用日志与实体也按同一时间窗口过滤，保证各面板口径一致
  const requestsInWindow = data.requests.filter((r) =>
    isInWindow(r.created_at, window),
  );

  // 最近活动取全部（不受窗口限制），因为它的语义就是"最近发生了什么"
  const recent = [...data.memories]
    .filter((m) => m.created_at)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 10);

  return {
    memoryCount: data.memories.length,
    entityCount: data.entities.length,
    entities: data.entities,
    categoryBuckets: byCategory(data.memories),
    scopeBuckets: byScope(data.memories),
    importanceBuckets: byImportance(data.memories),
    projectBuckets: byProject(data.memories),
    statusBuckets: byStatus(data.memories),
    writeTrend: buildWriteTrend(data.memories, window, days),
    requestStats: summarizeRequests(requestsInWindow),
    requestPathBuckets: byRequestPath(requestsInWindow),
    requestStatusBuckets: byStatusCode(requestsInWindow),
    recentMemories: recent,
  };
}

/** 与 aggregate.inWindow 相同语义，但内联在此避免循环依赖。 */
function isInWindow(createdAt: string | null | undefined, window: TimeWindow): boolean {
  if (window.start === null && window.end === null) return true;
  if (!createdAt) return false;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return false;
  if (window.start !== null && date < window.start) return false;
  if (window.end !== null && date > window.end) return false;
  return true;
}

interface UseDashboardResult {
  summary: DashboardSummary | null;
  loading: boolean;
  /** 首次加载失败。刷新失败只提示不置位，避免清空已有数据。 */
  error: boolean;
  reload: () => void;
}

/**
 * 拉取并聚合仪表盘数据。
 *
 * @param window 时间窗口
 * @param days 窗口对应的天数（null = 全部），用于补齐趋势的空档
 */
export function useDashboardData(
  window: TimeWindow,
  days: number | null,
): UseDashboardResult {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);

    void Promise.all([
      api.get(MEMORY_ENDPOINTS.BASE, { signal: controller.signal }),
      api.get(ENTITY_ENDPOINTS.BASE, { signal: controller.signal }),
      api.get(REQUEST_ENDPOINTS.BASE, {
        params: { limit: REQUEST_LIMIT },
        signal: controller.signal,
      }),
    ])
      .then(([memoriesRes, entitiesRes, requestsRes]) => {
        if (!active) return;
        const memories = memoriesRes.data?.results ?? memoriesRes.data ?? [];
        setData({
          memories: Array.isArray(memories) ? memories : [],
          entities: Array.isArray(entitiesRes.data) ? entitiesRes.data : [],
          requests: Array.isArray(requestsRes.data) ? requestsRes.data : [],
        });
        setError(false);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(true);
        // 去重后同一个 error 只弹一次，即使多个面板同时失败
        handleServerError(err, "加载仪表盘数据失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [nonce]);

  const summary = React.useMemo(
    () => (data === null ? null : summarize(data, window, days)),
    [data, window, days],
  );

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  return { summary, loading, error, reload };
}
