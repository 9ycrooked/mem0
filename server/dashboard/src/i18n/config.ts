/**
 * i18next 初始化配置。
 *
 * 与 new-api 的差异（重要）：
 * new-api 是纯 CSR（Rsbuild SPA），可以直接用 i18next-browser-languagedetector
 * 在模块顶层探测语言。mem0 dashboard 是 Next.js App Router，模块会在**服务端**
 * 先执行一次——那时没有 window/localStorage，直接用 LanguageDetector 会报错或
 * 造成 hydration 不一致。
 *
 * 因此这里的做法是：
 *   服务端：从 cookie 读语言（src/i18n/server.ts），再把它传给 Provider
 *   客户端：使用服务端给的语言初始化，切换时写回 cookie
 *
 * 即语言状态的唯一真相源是 **cookie**，不是 localStorage。
 * 这与 mem0 已有的 cookie 认证机制一致。
 */

import i18n, { type InitOptions } from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LANGUAGE, type LanguageCode } from "./languages";

import enAuth from "./locales/en/auth.json";
import enCommon from "./locales/en/common.json";
import enDashboard from "./locales/en/dashboard.json";
import enPages from "./locales/en/pages.json";
import zhAuth from "./locales/zh/auth.json";
import zhCommon from "./locales/zh/common.json";
import zhDashboard from "./locales/zh/dashboard.json";
import zhPages from "./locales/zh/pages.json";

/** 资源表。新增语言时在此登记，保持 en 为回退。 */
export const resources = {
  en: { common: enCommon, dashboard: enDashboard, auth: enAuth, pages: enPages },
  zh: { common: zhCommon, dashboard: zhDashboard, auth: zhAuth, pages: zhPages },
} as const;

/** 默认命名空间。 */
export const DEFAULT_NAMESPACE = "common";

export function createI18nOptions(language: LanguageCode): InitOptions {
  return {
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: Object.keys(resources),
    defaultNS: DEFAULT_NAMESPACE,
    ns: Object.keys(resources.en),
    interpolation: {
      // React 已经做了 XSS 转义，i18next 再转一次会把中文和符号转义坏
      escapeValue: false,
    },
    returnNull: false,
  };
}

/**
 * 在客户端初始化一个独立的 i18n 实例。
 *
 * 服务端渲染时**不要**调用（用 getServerLanguage + Provider 的 initialLanguage 代替）。
 */
export function createClientI18n(language: LanguageCode) {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init(createI18nOptions(language));
  return instance;
}
