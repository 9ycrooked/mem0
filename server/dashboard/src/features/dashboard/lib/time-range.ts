/**
 * 仪表盘时间范围与粒度。
 *
 * 自维护 fork 新增。设计参考 new-api 的
 * `features/dashboard/components/models/models-filter-dialog.tsx`，
 * 但预设改为本项目的需求：今日 / 7 天 / 30 天 / 全部。
 *
 * 「全部」是 new-api 没有的选项，因此这里的 days 允许为 null，
 * 且粒度是「禁用」而不是某个具体值 —— 详见 resolveGranularity。
 *
 * 全部为纯函数，便于单测（见 time-range.test.ts）。
 */

/** 图表的时间粒度。 */
export type TimeGranularity = "hour" | "day" | "week" | "none";

/** 时间范围预设。days 为 null 表示不限（全部）。 */
export const TIME_RANGE_PRESETS = [
  { key: "today", days: 1 },
  { key: "last7Days", days: 7 },
  { key: "last30Days", days: 30 },
  { key: "all", days: null },
] as const;

export type TimeRangePresetKey = (typeof TIME_RANGE_PRESETS)[number]["key"];

/** 预设 key → 天数（null = 全部）。 */
export function presetDays(key: TimeRangePresetKey): number | null {
  return TIME_RANGE_PRESETS.find((preset) => preset.key === key)?.days ?? null;
}

/**
 * 预设区间隐含的合理粒度。
 *
 * 与 new-api 同思路：选「7 天」应当自动切到按天聚合，而不是沿用上一档的按小时。
 * 「全部」没有合理粒度，返回 none 由调用方决定是否隐藏粒度选择器。
 */
export function granularityForRangeDays(days: number | null): TimeGranularity {
  if (days === null) return "none";
  if (days <= 1) return "hour";
  if (days <= 30) return "day";
  return "week";
}

/**
 * 反向推导：给定实际时间区间，判断它是否正好等于某个预设，用于高亮对应按钮。
 *
 * 用户的区间若不是精确的预设跨度（例如手动改过起止时间），返回 null，
 * 此时所有快捷按钮都不高亮 —— 与 new-api 行为一致。
 */
export function detectPresetFromRange(
  start: Date | null | undefined,
  end: Date | null | undefined,
): TimeRangePresetKey | null {
  if (!start || !end) return null;

  const millis = end.getTime() - start.getTime();
  if (!Number.isFinite(millis) || millis < 0) return null;

  const days = Math.round(millis / 86_400_000);

  const matched = TIME_RANGE_PRESETS.find(
    (preset) => preset.days !== null && preset.days === days,
  );
  return matched?.key ?? null;
}

/**
 * 把预设换算成实际时间区间。
 *
 * 「全部」返回两个 null（调用方不加时间过滤）。
 * 其他预设以 end 为基准往前推 days 天 —— 传入 end 便于测试时确定时间。
 */
export function resolveRange(
  key: TimeRangePresetKey,
  end: Date = new Date(),
): { start: Date | null; end: Date | null } {
  const days = presetDays(key);
  if (days === null) return { start: null, end: null };

  const start = new Date(end.getTime() - days * 86_400_000);
  return { start, end };
}

/**
 * 默认预设。首次进入（localStorage 无记录）时使用。
 */
export const DEFAULT_TIME_RANGE: TimeRangePresetKey = "last7Days";
