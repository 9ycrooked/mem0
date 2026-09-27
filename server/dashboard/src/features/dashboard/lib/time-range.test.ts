import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIME_RANGE,
  TIME_RANGE_PRESETS,
  detectPresetFromRange,
  granularityForRangeDays,
  presetDays,
  resolveRange,
  type TimeRangePresetKey,
} from "./time-range";

const DAY = 86_400_000;

describe("presetDays", () => {
  it("返回各预设的天数", () => {
    expect(presetDays("today")).toBe(1);
    expect(presetDays("last7Days")).toBe(7);
    expect(presetDays("last30Days")).toBe(30);
  });

  it("「全部」返回 null", () => {
    expect(presetDays("all")).toBeNull();
  });
});

describe("granularityForRangeDays", () => {
  it("1 天按小时", () => {
    expect(granularityForRangeDays(1)).toBe("hour");
  });

  it("7 天与 30 天按天", () => {
    expect(granularityForRangeDays(7)).toBe("day");
    expect(granularityForRangeDays(30)).toBe("day");
  });

  it("超过 30 天按周", () => {
    expect(granularityForRangeDays(31)).toBe("week");
    expect(granularityForRangeDays(365)).toBe("week");
  });

  it("全部（null）返回 none", () => {
    expect(granularityForRangeDays(null)).toBe("none");
  });

  it("边界：0 天与负数也归到 hour", () => {
    expect(granularityForRangeDays(0)).toBe("hour");
    expect(granularityForRangeDays(-1)).toBe("hour");
  });
});

describe("detectPresetFromRange", () => {
  const end = new Date("2026-09-27T12:00:00Z");

  it("精确匹配各预设", () => {
    expect(detectPresetFromRange(new Date(end.getTime() - DAY), end)).toBe("today");
    expect(detectPresetFromRange(new Date(end.getTime() - 7 * DAY), end)).toBe("last7Days");
    expect(detectPresetFromRange(new Date(end.getTime() - 30 * DAY), end)).toBe("last30Days");
  });

  it("非预设跨度返回 null（所有按钮都不高亮）", () => {
    expect(detectPresetFromRange(new Date(end.getTime() - 3 * DAY), end)).toBeNull();
    expect(detectPresetFromRange(new Date(end.getTime() - 14 * DAY), end)).toBeNull();
  });

  it("缺失任一端点返回 null", () => {
    expect(detectPresetFromRange(null, end)).toBeNull();
    expect(detectPresetFromRange(end, null)).toBeNull();
    expect(detectPresetFromRange(undefined, undefined)).toBeNull();
  });

  it("结束早于开始时返回 null", () => {
    expect(detectPresetFromRange(end, new Date(end.getTime() - DAY))).toBeNull();
  });

  it("容忍毫秒级误差（用户手动选日期时的取整）", () => {
    // 6.999 天应被 Math.round 归到 7
    const start = new Date(end.getTime() - 7 * DAY + 60_000);
    expect(detectPresetFromRange(start, end)).toBe("last7Days");
  });
});

describe("resolveRange", () => {
  const end = new Date("2026-09-27T12:00:00Z");

  it("按天数往前推", () => {
    const range = resolveRange("last7Days", end);
    expect(range.end).toEqual(end);
    expect(range.start?.getTime()).toBe(end.getTime() - 7 * DAY);
  });

  it("今日推 1 天", () => {
    const range = resolveRange("today", end);
    expect(range.start?.getTime()).toBe(end.getTime() - DAY);
  });

  it("全部返回两个 null", () => {
    const range = resolveRange("all", end);
    expect(range.start).toBeNull();
    expect(range.end).toBeNull();
  });

  it("产出的区间能被 detectPresetFromRange 反向识别", () => {
    for (const preset of TIME_RANGE_PRESETS) {
      if (preset.days === null) continue;
      const range = resolveRange(preset.key as TimeRangePresetKey, end);
      expect(detectPresetFromRange(range.start, range.end)).toBe(preset.key);
    }
  });
});

describe("预设表自身的一致性", () => {
  it("每个预设都有唯一 key", () => {
    const keys = TIME_RANGE_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("恰好有一个「全部」预设，且排在最后", () => {
    const unlimited = TIME_RANGE_PRESETS.filter((p) => p.days === null);
    expect(unlimited).toHaveLength(1);
    expect(TIME_RANGE_PRESETS[TIME_RANGE_PRESETS.length - 1].key).toBe("all");
  });

  it("默认预设存在且不是「全部」", () => {
    const found = TIME_RANGE_PRESETS.find((p) => p.key === DEFAULT_TIME_RANGE);
    expect(found).toBeDefined();
    expect(found?.days).not.toBeNull();
  });
});
