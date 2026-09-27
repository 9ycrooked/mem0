import { describe, expect, it } from "vitest";

import {
  buildWriteTrend,
  byCategory,
  byImportance,
  byProject,
  byRequestPath,
  byScope,
  byStatusCode,
  byStatus,
  countBy,
  inWindow,
  summarizeRequests,
  type MemoryRecord,
  type RequestRecord,
} from "./aggregate";

function mem(overrides: Partial<MemoryRecord> & { id: string }): MemoryRecord {
  return { memory: "text", ...overrides };
}

describe("inWindow", () => {
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-09-30T00:00:00Z");

  it("不限窗口时全部通过", () => {
    expect(inWindow("2020-01-01T00:00:00Z", { start: null, end: null })).toBe(true);
    expect(inWindow(null, { start: null, end: null })).toBe(true);
  });

  it("在窗口内", () => {
    expect(inWindow("2026-09-15T00:00:00Z", { start, end })).toBe(true);
  });

  it("早于起点或晚于终点都不算", () => {
    expect(inWindow("2026-08-31T23:59:59Z", { start, end })).toBe(false);
    expect(inWindow("2026-10-01T00:00:00Z", { start, end })).toBe(false);
  });

  it("边界时刻算在内", () => {
    expect(inWindow(start.toISOString(), { start, end })).toBe(true);
    expect(inWindow(end.toISOString(), { start, end })).toBe(true);
  });

  it("时间缺失或非法时，有限窗口下返回 false", () => {
    expect(inWindow(null, { start, end })).toBe(false);
    expect(inWindow("not a date", { start, end })).toBe(false);
  });
});

describe("countBy", () => {
  it("按数量降序", () => {
    const items = ["a", "b", "b", "c", "c", "c"];
    expect(countBy(items, (x) => x)).toEqual([
      { key: "c", count: 3 },
      { key: "b", count: 2 },
      { key: "a", count: 1 },
    ]);
  });

  it("数量相同时按 key 升序（保证输出稳定）", () => {
    const items = ["z", "a", "m"];
    expect(countBy(items, (x) => x).map((b) => b.key)).toEqual(["a", "m", "z"]);
  });

  it("null 归到一个 unknown 桶并排在最后", () => {
    const items = ["a", null, "a", null];
    const buckets = countBy(items, (x) => x);
    expect(buckets).toEqual([
      { key: "a", count: 2 },
      { key: "unknown", count: 2 },
    ]);
  });

  it("空输入返回空数组", () => {
    expect(countBy([], (x: string) => x)).toEqual([]);
  });
});

describe("按 metadata 分组", () => {
  const memories: MemoryRecord[] = [
    mem({ id: "1", metadata: { category: "preference", scope: "user", importance: "permanent" } }),
    mem({ id: "2", metadata: { category: "project", scope: "project", importance: "long_term", project: "dsh" } }),
    mem({ id: "3", metadata: { category: "project", scope: "project", importance: "long_term", project: "dsh" } }),
    mem({ id: "4", metadata: { status: "historical" } }),
    mem({ id: "5", metadata: null }),
  ];

  it("byCategory 只统计有 category 的", () => {
    expect(byCategory(memories)).toEqual([
      { key: "project", count: 2 },
      { key: "preference", count: 1 },
      { key: "unknown", count: 2 },
    ]);
  });

  it("byScope", () => {
    expect(byScope(memories)[0]).toEqual({ key: "project", count: 2 });
  });

  it("byImportance", () => {
    expect(byImportance(memories)[0]).toEqual({ key: "long_term", count: 2 });
  });

  it("byProject 只统计带 project 的", () => {
    expect(byProject(memories)).toEqual([
      { key: "dsh", count: 2 },
      { key: "unknown", count: 3 },
    ]);
  });

  it("byStatus：unknown 桶固定排在最后，不参与排序", () => {
    const buckets = byStatus(memories);
    expect(buckets).toEqual([
      { key: "historical", count: 1 },
      { key: "unknown", count: 4 },
    ]);
  });

  it("空字符串字段视为缺失", () => {
    const rows = [mem({ id: "x", metadata: { category: "" } })];
    expect(byCategory(rows)).toEqual([{ key: "unknown", count: 1 }]);
  });
});

describe("buildWriteTrend", () => {
  const window = { start: null, end: null };

  it("补齐中间没有数据的日期", () => {
    const memories = [
      mem({ id: "1", created_at: "2026-09-01T10:00:00Z" }),
      mem({ id: "2", created_at: "2026-09-03T10:00:00Z" }),
    ];
    const trend = buildWriteTrend(memories, { start: null, end: new Date("2026-09-03T23:00:00Z") }, 3);
    expect(trend).toEqual([
      { date: "2026-09-01", count: 1 },
      { date: "2026-09-02", count: 0 },
      { date: "2026-09-03", count: 1 },
    ]);
  });

  it("同一天多条会累加", () => {
    const memories = [
      mem({ id: "1", created_at: "2026-09-01T01:00:00Z" }),
      mem({ id: "2", created_at: "2026-09-01T23:00:00Z" }),
    ];
    const trend = buildWriteTrend(memories, { start: null, end: new Date("2026-09-01T23:00:00Z") }, 1);
    expect(trend).toEqual([{ date: "2026-09-01", count: 2 }]);
  });

  it("无数据返回空数组", () => {
    expect(buildWriteTrend([], { start: null, end: null }, 7)).toEqual([]);
  });

  it("时间缺失的记录被忽略", () => {
    const memories = [mem({ id: "1", created_at: null })];
    expect(buildWriteTrend(memories, { start: null, end: null }, 7)).toEqual([]);
  });

  it("days 为 null 时从最早一条开始", () => {
    const memories = [
      mem({ id: "1", created_at: "2026-08-30T10:00:00Z" }),
      mem({ id: "2", created_at: "2026-09-01T10:00:00Z" }),
    ];
    const trend = buildWriteTrend(memories, { start: null, end: new Date("2026-09-01T12:00:00Z") }, null);
    expect(trend.map((p) => p.date)).toEqual(["2026-08-30", "2026-08-31", "2026-09-01"]);
  });

  it("窗口外的时间不计入", () => {
    const memories = [
      mem({ id: "1", created_at: "2026-08-01T10:00:00Z" }),
      mem({ id: "2", created_at: "2026-09-01T10:00:00Z" }),
    ];
    const trend = buildWriteTrend(
      memories,
      { start: new Date("2026-08-15T00:00:00Z"), end: new Date("2026-09-01T12:00:00Z") },
      2,
    );
    const total = trend.reduce((sum, p) => sum + p.count, 0);
    expect(total).toBe(1);
  });
});

describe("summarizeRequests", () => {
  const req = (overrides: Partial<RequestRecord> & { id: string }): RequestRecord => ({
    method: "GET",
    path: "/memories",
    status_code: 200,
    latency_ms: 10,
    ...overrides,
  });

  it("空输入全为 0", () => {
    expect(summarizeRequests([])).toEqual({
      total: 0,
      errors: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      maxLatencyMs: 0,
    });
  });

  it("统计总数与错误数（非 2xx 都算错误）", () => {
    const stats = summarizeRequests([
      req({ id: "1", status_code: 200 }),
      req({ id: "2", status_code: 401 }),
      req({ id: "3", status_code: 500 }),
      req({ id: "4", status_code: 302 }),
    ]);
    expect(stats.total).toBe(4);
    expect(stats.errors).toBe(3);
    expect(stats.errorRate).toBe(0.75);
  });

  it("平均与最大延迟", () => {
    const stats = summarizeRequests([
      req({ id: "1", latency_ms: 10 }),
      req({ id: "2", latency_ms: 30 }),
    ]);
    expect(stats.avgLatencyMs).toBe(20);
    expect(stats.maxLatencyMs).toBe(30);
  });

  it("非法延迟按 0 计，不产生 NaN", () => {
    const stats = summarizeRequests([
      req({ id: "1", latency_ms: Number.NaN }),
      req({ id: "2", latency_ms: 20 }),
    ]);
    expect(Number.isNaN(stats.avgLatencyMs)).toBe(false);
    expect(stats.avgLatencyMs).toBe(10);
  });

  it("负延迟归 0", () => {
    const stats = summarizeRequests([req({ id: "1", latency_ms: -5 })]);
    expect(stats.avgLatencyMs).toBe(0);
  });
});

describe("请求分组", () => {
  const req = (path: string, status: number, id: string): RequestRecord => ({
    id,
    method: "GET",
    path,
    status_code: status,
    latency_ms: 1,
  });

  it("byRequestPath 按调用次数降序", () => {
    const requests = [req("/memories", 200, "1"), req("/memories", 200, "2"), req("/entities", 200, "3")];
    expect(byRequestPath(requests)[0]).toEqual({ key: "/memories", count: 2 });
  });

  it("byStatusCode 按码值而非数量排序", () => {
    const requests = [req("/a", 500, "1"), req("/b", 200, "2"), req("/c", 200, "3")];
    expect(byStatusCode(requests)).toEqual([
      { key: "200", count: 2 },
      { key: "500", count: 1 },
    ]);
  });

  it("空路径算 unknown", () => {
    expect(byRequestPath([req("", 200, "1")])).toEqual([{ key: "unknown", count: 1 }]);
  });
});
