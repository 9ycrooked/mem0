import { describe, expect, it } from "vitest";

import { resources } from "./config";

/**
 * 字典完整性。
 *
 * 加入 i18n 后新增的风险：改了 zh 忘了改 en（或反之），
 * 表现为界面出现英文回退或 key 字面量，而且**不会报错**。
 * 这个测试把「两种语言的 key 必须完全一致」变成硬约束。
 */

type Dict = Record<string, unknown>;

/**
 * resources 是 `as const`（字面量类型），无法用 string 索引。
 * 这里窄化成普通字典访问，测试只关心结构不关心字面量类型。
 */
const dicts = resources as unknown as Record<string, Record<string, Dict>>;

/** 摊平成 a.b.c 形式的 key 集合。 */
function flatten(dict: Dict, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(dict)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flatten(value as Dict, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

const languages = Object.keys(resources);
const namespaces = Object.keys(resources.en);

describe("字典结构", () => {
  it("至少有 zh 与 en 两种语言", () => {
    expect(languages).toContain("zh");
    expect(languages).toContain("en");
  });

  it("每种语言都有全部命名空间", () => {
    for (const lang of languages) {
      expect(Object.keys(dicts[lang]).sort()).toEqual([...namespaces].sort());
    }
  });
});

describe("字典 key 一致性", () => {
  for (const namespace of namespaces) {
    it(`${namespace}: zh 与 en 的 key 完全一致`, () => {
      const zhKeys = flatten(resources.zh[namespace as keyof typeof resources.zh] as Dict);
      const enKeys = flatten(resources.en[namespace as keyof typeof resources.en] as Dict);

      // 分别断言，失败时报错信息能指出到底缺哪边
      expect(zhKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
      expect(enKeys.filter((k) => !zhKeys.includes(k))).toEqual([]);
    });
  }
});

describe("翻译值", () => {
  for (const namespace of namespaces) {
    it(`${namespace}: 没有空字符串值`, () => {
      const collect = (dict: Dict, prefix = ""): [string, unknown][] =>
        Object.entries(dict).flatMap(([key, value]) => {
          const path = prefix === "" ? key : `${prefix}.${key}`;
          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            return collect(value as Dict, path);
          }
          return [[path, value] as [string, unknown]];
        });

      for (const lang of languages) {
        const empty = collect(dicts[lang][namespace])
          .filter(([, value]) => typeof value === "string" && value.trim() === "")
          .map(([path]) => path);
        expect(empty).toEqual([]);
      }
    });

    it(`${namespace}: zh 与 en 的值不相同（未被遗忘翻译）`, () => {
      const collect = (dict: Dict, prefix = ""): Map<string, string> => {
        const out = new Map<string, string>();
        for (const [key, value] of Object.entries(dict)) {
          const path = prefix === "" ? key : `${prefix}.${key}`;
          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            for (const [k, v] of collect(value as Dict, path)) out.set(k, v);
          } else if (typeof value === "string") {
            out.set(path, value);
          }
        }
        return out;
      };

      const zh = collect(dicts.zh[namespace]);
      const en = collect(dicts.en[namespace]);

      // 允许少量品牌词/技术词两边一致，但不能大面积相同
      const identical = [...zh].filter(([key, value]) => en.get(key) === value);
      const ratio = identical.length / Math.max(zh.size, 1);
      expect(
        ratio,
        `以下 key 的中英文相同：${identical.map(([k]) => k).join(", ")}`,
      ).toBeLessThan(0.3);
    });
  }
});
