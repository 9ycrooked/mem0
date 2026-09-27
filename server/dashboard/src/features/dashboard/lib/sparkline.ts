/**
 * Sparkline 的几何计算（纯函数）。
 *
 * 自维护 fork 新增。算法参考 new-api 的
 * `features/dashboard/components/ui/stat-card.tsx`（其 sparkline 为手写 SVG，不用图表库），
 * 但拆成纯函数以便单测 —— new-api 把计算与渲染混在同一文件里，无法单独测试。
 *
 * 参考实现里 normalizeSparkline 的最小高度是 8、buildLineSparkline 的
 * viewBox 是 160x36、padding 3、strokeWidth 2.25，这里保持一致。
 */

/** 柱状 sparkline 的单根柱子。 */
export interface SparklineBar {
  position: number;
  /** 百分比高度（0-100），最小值 8 以保证有可见高度。 */
  height: number;
}

/** 折线 sparkline 的路径。 */
export interface SparklinePaths {
  linePath: string;
  areaPath: string;
}

/** 与参考实现一致的画布尺寸。 */
export const SPARKLINE_WIDTH = 160;
export const SPARKLINE_HEIGHT = 36;
const PADDING = 3;
const MIN_BAR_HEIGHT_PERCENT = 8;

/** 把任意输入清洗成有限非负数字：NaN / Infinity / 负数 / 非数字都变 0。 */
function sanitize(values: readonly number[] | undefined): number[] {
  if (!values?.length) return [];
  return values.map((value) => {
    const numeric = Number(value);
    // Number.isFinite 同时排除 NaN 与 ±Infinity —— 只判断 NaN 会让 Infinity
    // 参与后续运算，最终在 SVG 路径里产生 "NaN" 字符串。
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  });
}

/**
 * 柱状 sparkline 的高度分布。
 *
 * 全 0 时返回全 0（而不是全高），避免"没数据"看起来像"满格"。
 */
export function buildBarSparkline(
  values: readonly number[] | undefined,
): SparklineBar[] {
  const data = sanitize(values);
  if (data.length === 0) return [];

  const max = Math.max(...data);
  if (max <= 0) {
    return data.map((_, position) => ({ position, height: 0 }));
  }

  return data.map((value, position) => ({
    position,
    height: Math.max(MIN_BAR_HEIGHT_PERCENT, (value / max) * 100),
  }));
}

/**
 * 折线 sparkline 的 SVG 路径。
 *
 * 值为常量时（range = 0）所有点落在中线上，而不是贴底 —— 否则一条水平线会被画成
 * 贴着画布底边，看起来像"归零"。
 */
export function buildLineSparkline(
  values: readonly number[] | undefined,
): SparklinePaths | null {
  const data = sanitize(values);
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  const usableHeight = SPARKLINE_HEIGHT - PADDING * 2;

  const points = data.map((value, index) => {
    const x =
      data.length === 1
        ? SPARKLINE_WIDTH / 2
        : (index / (data.length - 1)) * SPARKLINE_WIDTH;

    let normalized = 0.5;
    if (range > 0) {
      normalized = (value - min) / range;
    }

    // SVG 的 y 轴向下，所以用 1 - normalized 翻转
    const y = PADDING + (1 - normalized) * usableHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const first = points.at(0);
  const last = points.at(-1);
  if (!first || !last) return null;

  // 面积路径：折线 + 回到右下 + 左下 + 闭合
  const areaPath = `${linePath} L ${last.x} ${SPARKLINE_HEIGHT} L ${first.x} ${SPARKLINE_HEIGHT} Z`;

  return { linePath, areaPath };
}
