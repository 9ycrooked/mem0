import { describe, expect, it } from "vitest";

import {
  buildAreaSpec,
  buildPieSpec,
  buildRankBarSpec,
  pickColor,
} from "./chart-specs";

const buckets = [
  { key: "project", count: 5 },
  { key: "preference", count: 3 },
];

/**
 * VChart 的 spec 类型把多数字段标成可选或联合类型，直接点访问无法通过 tsc。
 * 测试要断言的是「我们生成的 JSON 长什么样」，因此这里做一次窄化，
 * 而不是给生产代码加类型断言。
 */
type LooseSpec = Record<string, any>;
const loose = (spec: unknown): LooseSpec => spec as LooseSpec;

/** 取第一个 data 条目的 values 数组。 */
function firstValues(spec: unknown): any[] {
  const data = loose(spec).data;
  const first = Array.isArray(data) ? data[0] : undefined;
  return (first?.values as any[]) ?? [];
}

describe("pickColor", () => {
  it("同一主题同一 index 稳定", () => {
    expect(pickColor(0, "light")).toBe(pickColor(0, "light"));
  });

  it("超出色板长度时循环", () => {
    expect(pickColor(7, "light")).toBe(pickColor(0, "light"));
  });

  it("深浅主题给出不同颜色", () => {
    expect(pickColor(0, "light")).not.toBe(pickColor(0, "dark"));
  });

  it("始终返回合法色值", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(pickColor(i, "light")).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("buildPieSpec", () => {
  it("产出环形饼图", () => {
    const spec = loose(buildPieSpec(buckets, "light"));
    expect(spec.type).toBe("pie");
    expect(spec.innerRadius).toBeGreaterThan(0);
    expect(spec.outerRadius).toBeGreaterThan(spec.innerRadius);
  });

  it("每个分组都有对应色值", () => {
    const spec = loose(buildPieSpec(buckets, "light"));
    expect(spec.color).toHaveLength(2);
    expect(spec.color[0]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("labelOf 用于显示名（key 与展示名可不同）", () => {
    const spec = loose(
      buildPieSpec(buckets, "light", (key) => (key === "project" ? "项目" : key)),
    );
    expect(firstValues(spec)[0].type).toBe("项目");
  });

  it("空数据不抛异常", () => {
    expect(firstValues(buildPieSpec([], "light"))).toEqual([]);
  });

  it("背景透明（跟随卡片背景）", () => {
    expect(loose(buildPieSpec(buckets, "light")).background).toBe("transparent");
  });
});

describe("buildAreaSpec", () => {
  const trend = [
    { date: "2026-09-01", count: 1 },
    { date: "2026-09-02", count: 0 },
    { date: "2026-09-03", count: 4 },
  ];

  it("产出面积图并映射字段", () => {
    const spec = loose(buildAreaSpec(trend, "light"));
    expect(spec.type).toBe("area");
    expect(spec.xField).toBe("Time");
    expect(spec.yField).toBe("Count");
    expect(firstValues(spec)).toHaveLength(3);
  });

  it("保留 0 值数据点（趋势图不能跳过空档）", () => {
    expect(firstValues(buildAreaSpec(trend, "light"))[1]).toEqual({
      Time: "2026-09-02",
      Count: 0,
    });
  });

  it("隐藏数据点圆点，避免密集日期挤成一片", () => {
    expect(loose(buildAreaSpec(trend, "light")).point.visible).toBe(false);
  });

  it("空数据不抛异常", () => {
    expect(firstValues(buildAreaSpec([], "light"))).toEqual([]);
  });
});

describe("buildRankBarSpec", () => {
  it("产出横向柱状图", () => {
    const spec = loose(buildRankBarSpec(buckets, "light"));
    expect(spec.type).toBe("bar");
    expect(spec.direction).toBe("horizontal");
  });

  it("数值轴隐藏（数值直接标在柱子上）", () => {
    const spec = loose(buildRankBarSpec(buckets, "light"));
    const bottomAxis = (spec.axes as { orient: string; visible?: boolean }[]).find(
      (axis) => axis.orient === "bottom",
    );
    expect(bottomAxis?.visible).toBe(false);
  });

  it("标签外置可见", () => {
    const spec = loose(buildRankBarSpec(buckets, "light"));
    expect(spec.label.visible).toBe(true);
    expect(spec.label.position).toBe("outside");
  });

  it("隐藏图例（横向柱已用 Y 轴标注名称）", () => {
    expect(loose(buildRankBarSpec(buckets, "light")).legends.visible).toBe(false);
  });
});
