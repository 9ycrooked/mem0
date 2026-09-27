/**
 * 服务端语言解析。
 *
 * 只在 Server Component / Route Handler 中调用（依赖 next/headers）。
 * 解析顺序：cookie 显式偏好 > Accept-Language > 默认语言。
 */

import { cookies, headers } from "next/headers";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  detectLanguage,
  normalizeLanguage,
  parseAcceptLanguage,
  type LanguageCode,
} from "./languages";

/**
 * 读取当前请求应使用的语言。
 *
 * 放在 Server Component 里读 cookie，再把结果传给客户端 Provider，
 * 这样首屏渲染的语言就是对的，不会出现"先英文再闪成中文"。
 */
export async function getServerLanguage(): Promise<LanguageCode> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LANGUAGE_COOKIE)?.value;
  if (fromCookie) {
    // cookie 是我们自己写的，归一化只是为了防御手工篡改
    return normalizeLanguage(fromCookie);
  }

  const headerStore = await headers();
  const candidates = parseAcceptLanguage(headerStore.get("accept-language"));
  return detectLanguage(candidates);
}

export { DEFAULT_LANGUAGE };
