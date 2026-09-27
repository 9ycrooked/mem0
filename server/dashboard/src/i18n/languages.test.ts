import { describe, expect, it } from "vitest";

import {
  DEFAULT_LANGUAGE,
  detectLanguage,
  normalizeLanguage,
  parseAcceptLanguage,
} from "./languages";

describe("normalizeLanguage", () => {
  it("把中文的各种写法归一为 zh", () => {
    for (const input of ["zh", "zh-CN", "zh-cn", "zh-Hans", "zh_TW", "ZH"]) {
      expect(normalizeLanguage(input)).toBe("zh");
    }
  });

  it("把英文的各种写法归一为 en", () => {
    for (const input of ["en", "en-US", "en-GB", "EN"]) {
      expect(normalizeLanguage(input)).toBe("en");
    }
  });

  it("空值回落默认语言", () => {
    expect(normalizeLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage(null)).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage("")).toBe(DEFAULT_LANGUAGE);
  });

  it("不支持的语言回落默认语言", () => {
    expect(normalizeLanguage("fr")).toBe(DEFAULT_LANGUAGE);
    expect(normalizeLanguage("ja-JP")).toBe(DEFAULT_LANGUAGE);
  });

  it("容忍前后空格与大小写", () => {
    expect(normalizeLanguage("  zh-CN  ")).toBe("zh");
  });
});

describe("detectLanguage", () => {
  it("按顺序取第一个支持的语言", () => {
    expect(detectLanguage(["fr", "ja", "zh-CN", "en"])).toBe("zh");
    expect(detectLanguage(["fr", "ja", "en-US"])).toBe("en");
  });

  it("列表为空时回落默认语言", () => {
    expect(detectLanguage([])).toBe(DEFAULT_LANGUAGE);
  });

  it("全部不支持时回落默认语言", () => {
    expect(detectLanguage(["fr-FR", "de-DE"])).toBe(DEFAULT_LANGUAGE);
  });

  it("中文优先于英文（即使英文排在前面也不算错，按位置取胜）", () => {
    // 第一个命中的就是结果，这是浏览器语言优先级的语义
    expect(detectLanguage(["en-US", "zh-CN"])).toBe("en");
  });
});

describe("parseAcceptLanguage", () => {
  it("按 q 值降序排列", () => {
    expect(parseAcceptLanguage("en;q=0.5,zh-CN;q=0.9,fr;q=0.1")).toEqual([
      "zh-CN",
      "en",
      "fr",
    ]);
  });

  it("省略 q 时视为 1", () => {
    expect(parseAcceptLanguage("zh-CN,en;q=0.8")).toEqual(["zh-CN", "en"]);
  });

  it("空输入返回空数组", () => {
    expect(parseAcceptLanguage(undefined)).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage("")).toEqual([]);
  });

  it("忽略空段与带空格的写法", () => {
    expect(parseAcceptLanguage(" zh-CN , en;q=0.7 ,")).toEqual(["zh-CN", "en"]);
  });

  it("非法 q 值按 0 处理，排在最后", () => {
    const result = parseAcceptLanguage("en;q=abc,zh;q=0.5");
    expect(result).toEqual(["zh", "en"]);
  });
});

describe("解析结果可直接喂给 detectLanguage", () => {
  it("真实浏览器头 → 中文", () => {
    const header = "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7";
    expect(detectLanguage(parseAcceptLanguage(header))).toBe("zh");
  });

  it("真实浏览器头 → 英文", () => {
    const header = "en-US,en;q=0.9,zh-CN;q=0.8";
    expect(detectLanguage(parseAcceptLanguage(header))).toBe("en");
  });
});
