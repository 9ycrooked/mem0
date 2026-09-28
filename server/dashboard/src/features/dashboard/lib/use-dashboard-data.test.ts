import { describe, expect, it } from "vitest";

import {
  REQUEST_LIMIT,
  REQUEST_LIMIT_MAX,
  summarize,
  type DashboardData,
} from "./use-dashboard-data";

/**
 * 这里原本没有测试（use-dashboard-data 依赖 axios 与 React）。
 * 但有一个**纯函数**值得单独覆盖：summarize。
 * 它把原始数据折算成各面板的视图模型，逻辑出错会让整个仪表盘的数字都不对。
 *
 * 背景：`/requests` 的 limit 上限是 200（服务端校验，min 1 / max 200 / default 50）。
 * 曾经因为传了 500 导致接口返回 422，仪表盘的调用统计整块失效。
 * 该约束写在 REQUEST_LIMIT 的注释里；这里用一条断言把它钉住，
 * 避免以后有人随手调大。
 */

function emptyData(): DashboardData {
  return { memories: [], entities: [], requests: [] };
}

describe("REQUEST_LIMIT 与服务端约束一致", () => {
  it("不超过 /requests 的 limit 上限（超过会被 422 拒绝）", () => {
    expect(REQUEST_LIMIT).toBeLessThanOrEqual(REQUEST_LIMIT_MAX);
  });

  it("至少为 1（下限来自同一处校验）", () => {
    expect(REQUEST_LIMIT).toBeGreaterThanOrEqual(1);
  });

  it("是整数", () => {
    expect(Number.isInteger(REQUEST_LIMIT)).toBe(true);
  });
});

describe("summarize", () => {
  it("空数据不抛异常，各计数为 0", () => {
    const result = summarize(emptyData(), { start: null, end: null }, null);
    expect(result.memoryCount).toBe(0);
    expect(result.entityCount).toBe(0);
    expect(result.writeTrend).toEqual([]);
    expect(result.requestStats.total).toBe(0);
    expect(result.recentMemories).toEqual([]);
  });

  it("统计记忆与实体数量", () => {
    const data: DashboardData = {
      memories: [
        { id: "1", memory: "a", created_at: "2026-09-01T00:00:00Z" },
        { id: "2", memory: "b", created_at: "2026-09-02T00:00:00Z" },
      ],
      entities: [{ id: "u1", type: "user", total_memories: 2 }],
      requests: [],
    };
    const result = summarize(data, { start: null, end: null }, null);
    expect(result.memoryCount).toBe(2);
    expect(result.entityCount).toBe(1);
    expect(result.entities).toHaveLength(1);
  });

  it("最近活动按时间倒序，最多 10 条", () => {
    const memories = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      memory: `m${i}`,
      // i 越大越新
      created_at: new Date(Date.UTC(2026, 8, i + 1)).toISOString(),
    }));
    const result = summarize(
      { memories, entities: [], requests: [] },
      { start: null, end: null },
      null,
    );
    expect(result.recentMemories).toHaveLength(10);
    expect(result.recentMemories[0].id).toBe("14");
  });

  it("最近活动不受时间窗口限制（它的语义就是「最近发生了什么」）", () => {
    const data: DashboardData = {
      memories: [{ id: "old", memory: "x", created_at: "2020-01-01T00:00:00Z" }],
      entities: [],
      requests: [],
    };
    const result = summarize(
      data,
      { start: new Date("2026-01-01T00:00:00Z"), end: null },
      null,
    );
    expect(result.recentMemories).toHaveLength(1);
  });

  it("调用统计按时间窗口过滤，与其它面板口径一致", () => {
    const data: DashboardData = {
      memories: [],
      entities: [],
      requests: [
        { id: "1", method: "GET", path: "/a", status_code: 200, latency_ms: 5, created_at: "2026-09-15T00:00:00Z" },
        { id: "2", method: "GET", path: "/b", status_code: 200, latency_ms: 5, created_at: "2026-08-01T00:00:00Z" },
      ],
    };
    const result = summarize(
      data,
      { start: new Date("2026-09-01T00:00:00Z"), end: null },
      null,
    );
    expect(result.requestStats.total).toBe(1);
    expect(result.requestPathBuckets).toEqual([{ key: "/a", count: 1 }]);
  });

  it("非 2xx 计入错误率", () => {
    const data: DashboardData = {
      memories: [],
      entities: [],
      requests: [
        { id: "1", method: "GET", path: "/a", status_code: 200, latency_ms: 1 },
        { id: "2", method: "GET", path: "/a", status_code: 500, latency_ms: 1 },
      ],
    };
    const result = summarize(data, { start: null, end: null }, null);
    expect(result.requestStats.errorRate).toBe(0.5);
  });

  it("缺失 created_at 的记忆不影响计数（只影响趋势与近期列表）", () => {
    const data: DashboardData = {
      memories: [
        { id: "1", memory: "a", created_at: null },
        { id: "2", memory: "b", created_at: "2026-09-01T00:00:00Z" },
      ],
      entities: [],
      requests: [],
    };
    const result = summarize(data, { start: null, end: null }, null);
    expect(result.memoryCount).toBe(2);
    expect(result.recentMemories).toHaveLength(1);
  });
});
