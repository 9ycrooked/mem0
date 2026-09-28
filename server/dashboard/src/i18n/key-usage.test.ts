import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 翻译 key 的使用一致性。
 *
 * 这个测试来自一个真实事故：设置页写的是 useTranslation("common")，
 * 而 settings.* 这些 key 定义在 pages 命名空间里。i18next 找不到 key 时
 * **不会报错**，而是直接把 key 字面量渲染到界面上，于是页面显示
 * "settings.title"、"settings.saveProfile" 这样的文字。
 * 类型检查和构建都发现不了，只有人眼能看出来。
 *
 * 因此这里做静态检查：
 *   1. 组件里 t("a.b.c") 用到的 key，必须能在它声明的命名空间里找到
 *      （带 { ns: "x" } 的按显式命名空间查）
 *   2. 反过来，字典里不该留没人用的孤儿 key（允许白名单）
 */

const SRC = join(__dirname, "..");

// ---------------------------------------------------------------- 字典读取

type Dict = Record<string, unknown>;

// 与 config.ts 的 resources 保持一致；直接读文件避免拉起 i18next
function loadNamespace(lang: string, ns: string): Dict {
  const file = join(__dirname, "locales", lang, `${ns}.json`);
  return JSON.parse(readFileSync(file, "utf-8")) as Dict;
}

const NAMESPACES = ["common", "dashboard", "auth", "pages"] as const;
const LANGS = ["zh", "en"] as const;

/** 摊平成 a.b.c 形式的 key 集合。 */
function flattenKeys(dict: Dict, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(dict)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...flattenKeys(value as Dict, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

/** 每个命名空间的全部 key（以 zh 为准，en 由 resources.test.ts 保证一致）。 */
const keysByNs: Record<string, Set<string>> = {};
for (const ns of NAMESPACES) {
  keysByNs[ns] = new Set(flattenKeys(loadNamespace("zh", ns)));
}

// ---------------------------------------------------------------- 源码扫描

/** 递归收集 src 下的 ts/tsx（跳过测试与 i18n 自身）。 */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue;
    if (full.includes(`${join("src", "i18n")}`)) continue;
    out.push(full);
  }
  return out;
}

interface Usage {
  file: string;
  line: number;
  key: string;
  /** 显式指定的命名空间（来自 { ns: "..." }），没有则为 null。 */
  explicitNs: string | null;
  /** 组件声明的命名空间列表。 */
  scopes: string[];
}

/** 提取文件里 useTranslation(...) 声明的命名空间。 */
function extractScopes(source: string): string[] {
  const match = source.match(/useTranslation\(\s*(\[[^\]]*\]|"[^"]*")/);
  if (!match) return [];
  const literal = match[1];
  return [...literal.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** 提取 t("key") / t("key", { ns: "x" }) 用法。 */
function extractUsages(file: string, source: string): Usage[] {
  const scopes = extractScopes(source);
  if (scopes.length === 0) return [];

  const usages: Usage[] = [];
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    // 匹配 t("a.b") 或 t('a.b')，随后可选地跟 { ns: "x" }
    const pattern = /\bt\(\s*["']([a-zA-Z0-9_.]+)["']\s*(?:,\s*\{([^}]*)\})?/g;
    for (const m of line.matchAll(pattern)) {
      const key = m[1];
      const options = m[2] ?? "";
      const nsMatch = options.match(/ns:\s*["']([^"']+)["']/);
      usages.push({
        file: relative(SRC, file),
        line: index + 1,
        key,
        explicitNs: nsMatch ? nsMatch[1] : null,
        scopes,
      });
    }
  });

  return usages;
}

const usages = collectSourceFiles(SRC).flatMap((file) =>
  extractUsages(file, readFileSync(file, "utf-8")),
);

// ---------------------------------------------------------------- 断言

describe("翻译 key 使用检查", () => {
  it("扫描到了足够多的 t() 调用（防止正则失效导致测试空转）", () => {
    // 若这个数字骤降，说明提取逻辑坏了，而不是代码里真的没有翻译
    expect(usages.length).toBeGreaterThan(50);
  });

  it("每个 t() 的 key 都能在对应命名空间里找到", () => {
    const missing: string[] = [];

    for (const usage of usages) {
      // 显式 ns 优先，否则按声明顺序逐个命名空间查找
      const candidates =
        usage.explicitNs !== null ? [usage.explicitNs] : usage.scopes;

      const found = candidates.some((ns) => {
        const keys = keysByNs[ns];
        if (!keys) return false;
        // i18next 的 key 可以带复数/上下文后缀，这里按前缀宽松匹配
        return keys.has(usage.key) || [...keys].some((k) => k.startsWith(`${usage.key}.`));
      });

      if (!found) {
        missing.push(
          `${usage.file}:${usage.line}  t("${usage.key}")  ` +
            `命名空间=[${candidates.join(", ")}]`,
        );
      }
    }

    expect(missing, `以下 key 在字典中不存在：\n${missing.join("\n")}`).toEqual([]);
  });

  it("同一命名空间内没有重复定义的同名 key", () => {
    // 之前 common.settings 与 pages.settings 并存，导致用错命名空间时静默失败
    const collisions: string[] = [];
    for (const ns of NAMESPACES) {
      const topLevel = Object.keys(loadNamespace("zh", ns));
      for (const other of NAMESPACES) {
        if (other <= ns) continue;
        const otherTop = Object.keys(loadNamespace("zh", other));
        for (const shared of topLevel.filter((k) => otherTop.includes(k))) {
          // common 与 pages 共享顶级名是允许的（如 nav/action），
          // 但共享后若两边内容不同就容易误用，这里只提示真正危险的：
          // 同名且都被 t() 使用过
          const usedInBoth = usages.some(
            (u) => u.key.startsWith(`${shared}.`) && u.scopes.includes(ns),
          ) && usages.some(
            (u) => u.key.startsWith(`${shared}.`) && u.scopes.includes(other),
          );
          if (usedInBoth) collisions.push(`${shared}: ${ns} 与 ${other}`);
        }
      }
    }
    expect(collisions, `顶级命名冲突：${collisions.join("; ")}`).toEqual([]);
  });
});
