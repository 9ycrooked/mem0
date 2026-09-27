"use client";

/**
 * i18n Provider。
 *
 * 挂在 (root)/layout.tsx（Server Component）下，由服务端把解析好的语言传进来，
 * 保证首屏语言正确、不出现 hydration 不一致。
 *
 * 语言切换：写 cookie（服务端下次渲染会读到）+ 立即切换 i18n 实例（无需刷新）。
 */

import * as React from "react";
import { I18nextProvider } from "react-i18next";
import type { i18n as I18nInstance } from "i18next";

import { createClientI18n } from "./config";
import {
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  type LanguageCode,
} from "./languages";

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (next: LanguageCode) => void;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

/** 读取当前语言、切换语言。必须在 <I18nProvider> 内使用。 */
export function useLanguage(): LanguageContextValue {
  const value = React.useContext(LanguageContext);
  if (value === null) {
    throw new Error("useLanguage 必须在 <I18nProvider> 内使用");
  }
  return value;
}

interface I18nProviderProps {
  /** 服务端解析出的语言，作为初始值。 */
  initialLanguage: LanguageCode;
  children: React.ReactNode;
}

export function I18nProvider({ initialLanguage, children }: I18nProviderProps) {
  // 实例只创建一次；语言切换通过 changeLanguage 完成，不重建实例
  // （重建会导致整棵子树卸载重挂，丢失组件状态）
  const instanceRef = React.useRef<I18nInstance | null>(null);
  if (instanceRef.current === null) {
    instanceRef.current = createClientI18n(initialLanguage);
  }

  const [language, setLanguageState] = React.useState<LanguageCode>(initialLanguage);

  const setLanguage = React.useCallback((next: LanguageCode) => {
    setLanguageState(next);
    void instanceRef.current?.changeLanguage(next);

    // 写 cookie：服务端在下次请求（含刷新、SSR）时会读到，从而保持一致。
    // SameSite=Lax 足以覆盖站内跳转；这里不是凭据，不需要 HttpOnly。
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  // 服务端语言变化时（例如用户清掉 cookie 后重新进入）同步回客户端
  React.useEffect(() => {
    if (initialLanguage !== language && instanceRef.current) {
      setLanguageState(initialLanguage);
      void instanceRef.current.changeLanguage(initialLanguage);
    }
    // 只关心服务端值的变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLanguage]);

  const contextValue = React.useMemo<LanguageContextValue>(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      <I18nextProvider i18n={instanceRef.current}>{children}</I18nextProvider>
    </LanguageContext.Provider>
  );
}
