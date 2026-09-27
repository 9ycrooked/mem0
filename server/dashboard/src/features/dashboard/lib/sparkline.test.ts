import { describe, expect, it } from "vitest";

import {
  SPARKLINE_HEIGHT,
  SPARKLINE_WIDTH,
  buildBarSparkline,
  buildLineSparkline,
} from "./sparkline";

describe("buildBarSparkline", () => {
  it("空输入返回空数组", () => {
    expect(buildBarSparkline([])).toEqual([]);
    expect(buildBarSparkline(undefined)).toEqual([]);
  });

  it("最大值占满 100%", () => {
    const bars = buildBarSparkline([1, 2, 4]);
    expect(bars).toHaveLength(3);
    expect(bars[2].height).toBe(100);
    expect(bars[1].height).toBe(50);
    expect(bars[0].height).toBe(25);
  });

  it("最小值不低于 8%（保证可见）", () => {
    const bars = buildBarSparkline([1000, 1]);
    expect(bars[1].height).toBe(8);
  });

  it("全 0 时高度全为 0，而不是全高", () => {
    const bars = buildBarSparkline([0, 0, 0]);
    expect(bars.map((b) => b.height)).toEqual([0, 0, 0]);
  });

  it("有数据时，0 值柱仍保留 8% 的最小可见高度", () => {
    // 与参考实现一致：序列里还有非零值时，0 值柱子不消失（否则看起来像缺数据）。
    // 只有整个序列全 0 时才全部归 0。
    const bars = buildBarSparkline([-5, Number.NaN, 10]);
    expect(bars[0].height).toBe(8);
    expect(bars[1].height).toBe(8);
    expect(bars[2].height).toBe(100);
  });

  it("position 按顺序递增", () => {
    const bars = buildBarSparkline([1, 2, 3]);
    expect(bars.map((b) => b.position)).toEqual([0, 1, 2]);
  });
});

describe("buildLineSparkline", () => {
  it("空输入返回 null", () => {
    expect(buildLineSparkline([])).toBeNull();
    expect(buildLineSparkline(undefined)).toBeNull();
  });

  it("单点落在水平中点", () => {
    const paths = buildLineSparkline([5]);
    expect(paths).not.toBeNull();
    // range = 0 → normalized 取 0.5 → y = padding + 0.5 * usableHeight = 3 + 15 = 18
    expect(paths?.linePath).toBe(`M ${SPARKLINE_WIDTH / 2} 18`);
  });

  it("路径以 M 开头，后续点为 L", () => {
    const paths = buildLineSparkline([1, 2, 3]);
    const commands = paths?.linePath.split(" ").filter((p) => p === "M" || p === "L");
    expect(commands).toEqual(["M", "L", "L"]);
  });

  it("最大值在上边距、最小值在下边距", () => {
    const paths = buildLineSparkline([0, 10]);
    expect(paths).not.toBeNull();
    // 第一个点是最小值 0 → y 应在底部（36 - padding 3 = 33）
    // 第二个点是最大值 10 → y 应在顶部（padding 3）
    expect(paths?.linePath).toBe(`M 0 33 L ${SPARKLINE_WIDTH} 3`);
  });

  it("常量序列落在中线，不贴底", () => {
    const paths = buildLineSparkline([7, 7, 7]);
    // 中线 = padding + usableHeight/2 = 3 + 15 = 18
    expect(paths?.linePath).toBe(`M 0 18 L ${SPARKLINE_WIDTH / 2} 18 L ${SPARKLINE_WIDTH} 18`);
  });

  it("面积路径闭合且回到画布底部", () => {
    const paths = buildLineSparkline([1, 2]);
    expect(paths?.areaPath).toContain(`L ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`);
    expect(paths?.areaPath.endsWith("Z")).toBe(true);
  });

  it("全 0 序列不产生 NaN", () => {
    const paths = buildLineSparkline([0, 0, 0]);
    expect(paths?.linePath).not.toContain("NaN");
    expect(paths?.areaPath).not.toContain("NaN");
  });

  it("负数与 NaN 归 0 后不产生 NaN", () => {
    const paths = buildLineSparkline([-1, Number.NaN, Number.POSITIVE_INFINITY]);
    expect(paths?.linePath).not.toContain("NaN");
  });
});
