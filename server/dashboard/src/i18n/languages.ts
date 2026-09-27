/**
 * 语言定义。
 *
 * 自维护 fork 新增：官方 dashboard 无 i18n，此文件及 src/i18n/ 目录均为本地新增，
 * 不改动任何上游文件，因此上游合并时不会冲突。
 *
 * 命名约定与 new-api（QuantumNous/new-api）保持一致，便于后续参考其实现。
 */

export const LANGUAGE_OPTIONS = [
  { code: "zh", label: "简体中文" },
  { code: "en", label: "English" },
] as const;

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"];

/** 默认语言。未检测到偏好时使用。 */
export const DEFAULT_LANGUAGE: LanguageCode = "en";

/** 语言偏好的 cookie 名。 */
export const LANGUAGE_COOKIE = "mem0_lang";

/** cookie 有效期（秒）：一年。 */
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * 把浏览器或任意来源的语言标签归一化为本项目支持的语言码。
 *
 * 浏览器报的是标准 BCP-47（`zh-CN`、`zh-Hans`、`zh`、`en-US`…），
 * 而 i18next 的 resources 用的是简短码，不做映射中文浏览器永远匹配不上。
 */
export function normalizeLanguage(value?: string | null): LanguageCode {
  if (!value) return DEFAULT_LANGUAGE;

  const lower = value.trim().replaceAll("_", "-").toLowerCase();

  // 中文的各种写法都归一到 zh
  if (lower === "zh" || lower.startsWith("zh-")) return "zh";
  if (lower.startsWith("en")) return "en";

  return DEFAULT_LANGUAGE;
}

/**
 * 从浏览器语言列表里挑一个支持的语言。
 * @param candidates navigator.languages 或已解析的 Accept-Language 列表
 */
export function detectLanguage(candidates: readonly string[]): LanguageCode {
  for (const candidate of candidates) {
    const lower = candidate.trim().replaceAll("_", "-").toLowerCase();
    if (lower === "zh" || lower.startsWith("zh-")) return "zh";
    if (lower.startsWith("en")) return "en";
  }
  return DEFAULT_LANGUAGE;
}

/** 解析 Accept-Language 头，按 q 值排序后返回语言标签。 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((entry) => entry.tag !== "")
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.tag);
}
