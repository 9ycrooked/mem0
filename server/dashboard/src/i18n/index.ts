/** i18n 模块出口。 */

export {
  LANGUAGE_OPTIONS,
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  normalizeLanguage,
  detectLanguage,
  parseAcceptLanguage,
  type LanguageCode,
} from "./languages";

export { resources, createI18nOptions, createClientI18n, DEFAULT_NAMESPACE } from "./config";
export { I18nProvider, useLanguage } from "./provider";
export { getServerLanguage } from "./server";
