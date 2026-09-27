/**
 * 仪表盘的数据类型与聚合逻辑（纯函数）。
 *
 * 自维护 fork 新增。
 *
 * 重要前提（已对真实 API 实测）：
 *  - `GET /memories` 只接受 user_id / run_id / agent_id / top_k / show_expired，
 *    **没有时间范围参数**，因此时间筛选必须在客户端聚合。
 *  - `GET /requests` 只接受 limit，同样在客户端按时间过滤。
 *  - `/entities` 直接返回聚合好的总数，无需再算。
 *
 * 所有函数都是纯函数，便于单测（见 aggregate.test.ts）。
 */

// ------------------------------------------------------------------ 类型

/** `/memories` 返回的单条记忆。 */
export interface MemoryRecord {
  id: string;
  memory: string;
  user_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** `/entities` 返回的单个实体。 */
export interface EntityRecord {
  id: string;
  type: string;
  total_memories: number;
  created_at?: string | null;
  updated_at?: string | null;
}

/** `/requests` 返回的单条请求日志。 */
export interface RequestRecord {
  id: string;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  auth_type?: string | null;
  created_at?: string | null;
}

/** 时间窗口。null 表示不限（「全部」）。 */
export interface TimeWindow {
  start: Date | null;
  end: Date | null;
}

/** 一个「名称 → 数量」的分组项。 */
export interface Bucket {
  key: string;
  count: number;
}

/** 按天（或小时）的一个数据点。 */
export interface TrendPoint {
  /** ISO 日期（按天时为 YYYY-MM-DD）。 */
  date: string;
  count: number;
}

// ------------------------------------------------------------------ 工具

function metaString(record: MemoryRecord, key: string): string | null {
  const value = record.metadata?.[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 记录是否落在时间窗口内。无法解析时间的记录算作不在窗口内（窗口不限时除外）。 */
export function inWindow(
  createdAt: string | null | undefined,
  window: TimeWindow,
): boolean {
  if (window.start === null && window.end === null) return true;

  const date = parseDate(createdAt);
  if (date === null) return false;
  if (window.start !== null && date < window.start) return false;
  if (window.end !== null && date > window.end) return false;
  return true;
}

// ------------------------------------------------------------------ 聚合

/** 按任意取值函数分组计数，结果按数量降序（数量相同则按 key 升序，保证稳定）。 */
export function countBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string | null,
): Bucket[] {
  const counts = new Map<string, number>();
  let unknown = 0;

  for (const item of items) {
    const key = keyOf(item);
    if (key === null) {
      unknown += 1;
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const buckets = [...counts].map(([key, count]) => ({ key, count }));
  buckets.sort((a, b) => (b.count === a.count ? a.key.localeCompare(b.key) : b.count - a.count));

  if (unknown > 0) buckets.push({ key: "unknown", count: unknown });
  return buckets;
}

/** 按分类分组。 */
export function byCategory(memories: readonly MemoryRecord[]): Bucket[] {
  return countBy(memories, (m) => metaString(m, "category"));
}

/** 按作用域分组。 */
export function byScope(memories: readonly MemoryRecord[]): Bucket[] {
  return countBy(memories, (m) => metaString(m, "scope"));
}

/** 按重要度分组。 */
export function byImportance(memories: readonly MemoryRecord[]): Bucket[] {
  return countBy(memories, (m) => metaString(m, "importance"));
}

/** 按项目分组。 */
export function byProject(memories: readonly MemoryRecord[]): Bucket[] {
  return countBy(memories, (m) => metaString(m, "project"));
}

/** 按状态分组（current / historical / …）。 */
export function byStatus(memories: readonly MemoryRecord[]): Bucket[] {
  return countBy(memories, (m) => metaString(m, "status"));
}

const DAY_MS = 86_400_000;

/** 把日期截断到当天（UTC），返回 YYYY-MM-DD。 */
export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 写入趋势：按天统计新增记忆数。
 *
 * 会补齐中间没有数据的日期（count = 0），否则折线图会把断点连成直线，读起来像"一直有写入"。
 *
 * @param days 回溯天数。null 表示从最早一条记录开始。
 */
export function buildWriteTrend(
  memories: readonly MemoryRecord[],
  window: TimeWindow,
  days: number | null,
): TrendPoint[] {
  const dated = memories
    .map((m) => ({ record: m, date: parseDate(m.created_at) }))
    .filter((entry): entry is { record: MemoryRecord; date: Date } => entry.date !== null)
    .filter((entry) => inWindow(entry.record.created_at, window));

  if (dated.length === 0) return [];

  const end = window.end ?? new Date();
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  let startDay: Date;
  if (days !== null) {
    startDay = new Date(endDay.getTime() - (days - 1) * DAY_MS);
  } else {
    const earliest = dated.reduce(
      (min, entry) => (entry.date < min ? entry.date : min),
      dated[0].date,
    );
    startDay = new Date(
      Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), earliest.getUTCDate()),
    );
  }

  const counts = new Map<string, number>();
  for (const entry of dated) {
    const key = toDayKey(entry.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: TrendPoint[] = [];
  for (let time = startDay.getTime(); time <= endDay.getTime(); time += DAY_MS) {
    const key = toDayKey(new Date(time));
    points.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return points;
}

// ------------------------------------------------------------------ 调用统计

export interface RequestStats {
  total: number;
  /** 非 2xx 的数量。 */
  errors: number;
  /** 错误率，0-1。没有请求时为 0。 */
  errorRate: number;
  /** 平均延迟（毫秒）。没有请求时为 0。 */
  avgLatencyMs: number;
  /** 最慢的一次。 */
  maxLatencyMs: number;
}

/** 计算调用健康度。 */
export function summarizeRequests(requests: readonly RequestRecord[]): RequestStats {
  if (requests.length === 0) {
    return { total: 0, errors: 0, errorRate: 0, avgLatencyMs: 0, maxLatencyMs: 0 };
  }

  let errors = 0;
  let latencySum = 0;
  let maxLatency = 0;

  for (const request of requests) {
    if (request.status_code < 200 || request.status_code >= 300) errors += 1;
    const latency = Number.isFinite(request.latency_ms) ? Math.max(0, request.latency_ms) : 0;
    latencySum += latency;
    if (latency > maxLatency) maxLatency = latency;
  }

  return {
    total: requests.length,
    errors,
    errorRate: errors / requests.length,
    avgLatencyMs: latencySum / requests.length,
    maxLatencyMs: maxLatency,
  };
}

/** 按接口路径分组，用于看哪些接口被调得最多。 */
export function byRequestPath(requests: readonly RequestRecord[]): Bucket[] {
  return countBy(requests, (r) => (r.path === "" ? null : r.path));
}

/** 按 HTTP 状态码分组（按码值排序，而不是数量）。 */
export function byStatusCode(requests: readonly RequestRecord[]): Bucket[] {
  const buckets = countBy(requests, (r) => String(r.status_code));
  return buckets.sort((a, b) => Number(a.key) - Number(b.key));
}
