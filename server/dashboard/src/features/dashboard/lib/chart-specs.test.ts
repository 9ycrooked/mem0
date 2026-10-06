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

/**
 * 回归测试：tooltip 的 key/value 传字符串时 VChart 按常量文本渲染，
 * 悬浮只会显示 "type / value" 这样的字面量，真实数值不出现（线上实测 bug）。
 * 因此这三处必须是函数。
 */
describe("tooltip 取值（回归）", () => {
  const trend = [{ date: "2026-09-28", count: 569 }];

  it("饼图的 value 是回调，能取到分组数量", () => {
    const item = loose(buildPieSpec(buckets, "light")).tooltip.mark.content[0];
    expect(typeof item.value).toBe("function");
    expect(item.value({ value: 168 })).toBe("168");
  });

  it("饼图的数量标签可注入（跟随 i18n）", () => {
    const item = loose(buildPieSpec(buckets, "light", undefined, "数量")).tooltip.mark
      .content[0];
    expect(item.key).toBe("数量");
  });

  it("面积图的 value 是回调，能取到当天数量", () => {
    const item = loose(buildAreaSpec(trend, "light")).tooltip.mark.content[0];
    expect(typeof item.value).toBe("function");
    expect(item.value({ Count: 569 })).toBe("569");
  });

  it("面积图用 mark 模式：标题是当天日期（dimension 会一次列出全部点）", () => {
    const tooltip = loose(buildAreaSpec(trend, "light")).tooltip;
    expect(tooltip.dimension).toBeUndefined();
    expect(tooltip.mark.title.value({ Time: "2026-09-28" })).toBe("2026-09-28");
  });

  it("面积图的数量标签可注入（跟随 i18n）", () => {
    const item = loose(buildAreaSpec(trend, "light", "数量")).tooltip.mark.content[0];
    expect(item.key).toBe("数量");
  });

  it("排行图的 key/value 都是回调，能取到路径与次数", () => {
    const item = loose(buildRankBarSpec(buckets, "light")).tooltip.mark.content[0];
    expect(item.key({ name: "/memories" })).toBe("/memories");
    expect(item.value({ value: 76 })).toBe("76");
  });

  it("缺失字段回退为空串而不是抛异常", () => {
    const pie = loose(buildPieSpec(buckets, "light")).tooltip.mark.content[0];
    const area = loose(buildAreaSpec(trend, "light")).tooltip.mark.content[0];
    expect(pie.value({})).toBe("");
    expect(area.value({})).toBe("");
  });
});
