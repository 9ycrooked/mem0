/**
 * VChart spec 生成（纯函数）。
 *
 * 自维护 fork 新增。设计参考 new-api 的 `features/dashboard/lib/charts.ts`：
 * 它把图表配置做成**纯函数生成 JSON spec**，与 React 完全解耦，因此可以单测。
 * 这里沿用同一思路，好处是后续要从 new-api 抄更多图表时，
 * 只需再加一个 spec 函数，不用重写渲染层。
 *
 * 与参考实现的差异：
 *  - 主题色用本项目的 HSL 语义变量解析出的色值，而不是 new-api 的 dataScheme
 *  - 只实现本项目需要的最小 spec（饼图 / 面积图 / 柱状图），不做 sankey
 *
 * ⚠️ tooltip 的 key/value 必须传**回调函数**：
 * VChart 把字符串当作常量文本渲染，写成 `{ key: "type", value: "value" }`
 * 悬浮时只会原样显示 "type / value"，真实数值不会出现（2026-10-06 实测修复）。
 */

import type {
  IAreaChartSpec,
  IBarChartSpec,
  IPieChartSpec,
} from "@visactor/react-vchart";

import type { Bucket, TrendPoint } from "./aggregate";

/** 图表主题。 */
export type ChartTheme = "light" | "dark";

/**
 * 分类色板。
 *
 * 取自本项目 globals.css 里的品牌色系（purple / blue / green / amber / red），
 * 深浅两套，保证在两种主题下都有足够对比度。
 */
const PALETTE: Record<ChartTheme, string[]> = {
  light: ["#7C5CFF", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"],
  dark: ["#9B85FF", "#60A5FA", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#22D3EE"],
};

/** 按 index 取色，超出色板长度时循环。 */
export function pickColor(index: number, theme: ChartTheme): string {
  const palette = PALETTE[theme];
  return palette[index % palette.length];
}

/**
 * 从 tooltip 回调拿到的 datum 上安全取字段。
 *
 * VChart 的回调签名是 `(datum: Datum | undefined) => string`，而库里 `Datum`
 * 的定义过宽（也可能是数组），直接写 `datum.value` 过不了 tsc。这里统一做一次
 * 窄化，顺便把缺失字段收敛成空串，避免 tooltip 出现 "undefined"。
 */
export function datumField(datum: unknown, field: string): string {
  if (datum === null || typeof datum !== "object") return "";
  const value = (datum as Record<string, unknown>)[field];
  return value === null || value === undefined ? "" : String(value);
}

/** 通用的饼图 spec。用于"分类分布"。 */
export function buildPieSpec(
  buckets: readonly Bucket[],
  theme: ChartTheme,
  labelOf: (key: string) => string = (key) => key,
  countLabel = "Count",
): IPieChartSpec {
  const values = buckets.map((bucket, index) => ({
    type: labelOf(bucket.key),
    value: bucket.count,
    color: pickColor(index, theme),
  }));

  return {
    type: "pie" as const,
    data: [{ id: "pie", values }],
    outerRadius: 0.8,
    innerRadius: 0.55, // 环形，中间留白放总数
    padAngle: 0.6,
    valueField: "value",
    categoryField: "type",
    // VChart 按顺序把色板分配给各分类；比手写 scale 对象更简洁且类型安全
    color: values.map((v) => v.color),
    legends: { visible: true, orient: "left" as const },
    label: { visible: false }, // 空间小，标签改用 tooltip + 图例
    tooltip: {
      mark: {
        content: [
          {
            key: countLabel,
            value: (datum) => datumField(datum, "value"),
          },
        ],
      },
    },
    animation: true,
    background: "transparent",
  };
}

/** 面积图 spec。用于"写入趋势"。 */
export function buildAreaSpec(
  trend: readonly TrendPoint[],
  theme: ChartTheme,
  countLabel = "Count",
): IAreaChartSpec {
  const values = trend.map((point) => ({ Time: point.date, Count: point.count }));

  return {
    type: "area" as const,
    data: [{ id: "area", values }],
    xField: "Time",
    yField: "Count",
    point: { visible: false },
    line: { style: { lineWidth: 2, stroke: pickColor(0, theme) } },
    area: {
      style: {
        fill: pickColor(0, theme),
        fillOpacity: 0.12,
      },
    },
    axes: [
      { orient: "bottom" as const, type: "band" as const, label: { autoHide: true } },
      { orient: "left" as const, type: "linear" as const },
    ],
    tooltip: {
      // 用 mark 而不是 dimension：dimension 会按系列聚合，而本图没有 seriesField，
      // 实测表现为「悬浮一次就把全部日期的值刷成多行」。mark 只报悬浮到的那个点。
      mark: {
        title: { value: (datum) => datumField(datum, "Time") },
        content: [
          {
            key: countLabel,
            value: (datum) => datumField(datum, "Count"),
          },
        ],
      },
    },
    animation: true,
    background: "transparent",
  };
}

/** 横向柱状图 spec。用于"接口调用排行"。 */
export function buildRankBarSpec(
  buckets: readonly Bucket[],
  theme: ChartTheme,
  labelOf: (key: string) => string = (key) => key,
): IBarChartSpec {
  const values = buckets.map((bucket, index) => ({
    name: labelOf(bucket.key),
    value: bucket.count,
    color: pickColor(index, theme),
  }));

  return {
    type: "bar" as const,
    direction: "horizontal" as const,
    data: [{ id: "rank", values }],
    xField: "value",
    yField: "name",
    bar: { style: { cornerRadius: 4 } },
    // 同 pie：按顺序提供色板
    color: values.map((v) => v.color),
    axes: [
      { orient: "left" as const, type: "band" as const },
      { orient: "bottom" as const, type: "linear" as const, visible: false },
    ],
    label: {
      visible: true,
      position: "outside" as const,
      style: { fontSize: 11 },
    },
    legends: { visible: false },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum) => datumField(datum, "name"),
            value: (datum) => datumField(datum, "value"),
          },
        ],
      },
    },
    animation: true,
    background: "transparent",
  };
}
