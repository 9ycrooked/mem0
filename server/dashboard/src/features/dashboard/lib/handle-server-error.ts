"use client";

/**
 * 统一的错误提示入口。
 *
 * 自维护 fork 新增。设计参考 new-api 的 `lib/handle-server-error.ts`，
 * 核心是 **WeakSet 去重**：
 *
 * 仪表盘是"一次请求喂多个面板"的架构，同一个 Error 对象会被多个组件拿到。
 * 若每个组件各自 toast，用户会看到同一错误弹三四次。用 WeakSet 记住已提示过的
 * 错误对象，后续调用直接跳过。
 *
 * 复用 mem0 已有的 getErrorMessage（src/lib/error-message.ts）解析文案，
 * 它已经正确处理了 axios 与 FastAPI 的 detail 结构。
 */

import { toast } from "sonner";

import { getErrorMessage } from "@/lib/error-message";

/** 已提示过的错误对象。WeakSet 不会阻止对象被回收。 */
const reported = new WeakSet<object>();

/**
 * 标记错误已处理，让后续的 handleServerError 静默。
 *
 * 适用场景：调用方自己已经弹过更具体的提示（例如某个卡片内的 inline 错误），
 * 不希望上层的兜底逻辑再弹一次。
 */
export function markErrorHandled(error: unknown): void {
  for (const source of errorSources(error)) {
    reported.add(source);
  }
}

/** 判断该错误是否已被提示过。 */
export function isErrorHandled(error: unknown): boolean {
  return errorSources(error).some((source) => reported.has(source));
}

/**
 * 取出错误对象本身及其可作标识的关联对象。
 *
 * 只对 object 生效（WeakSet 要求）；原始值（string / number）无法去重，
 * 这类错误重复出现时每 次都会提示，这可以接受 —— 它们通常不带堆栈，
 * 而是调用方手工构造的文案。
 */
function errorSources(error: unknown): object[] {
  if (error === null || typeof error !== "object") return [];
  const sources: object[] = [error];

  // axios 错误的外层与 cause 是不同对象，都记上以免漏判
  const cause = (error as { cause?: unknown }).cause;
  if (cause !== null && typeof cause === "object") sources.push(cause);

  return sources;
}

export interface HandleServerErrorOptions {
  /** 覆盖文案（优先于从错误里解析）。 */
  message?: string;
  /** 追加在标题下方的说明。 */
  description?: string;
}

/**
 * 提示一个服务端错误。
 *
 * @returns 本次是否真的弹了（已提示过则返回 false）。
 */
export function handleServerError(
  error: unknown,
  fallbackMessage = "Something went wrong",
  options: HandleServerErrorOptions = {},
): boolean {
  if (isErrorHandled(error)) return false;
  markErrorHandled(error);

  const text = options.message ?? getErrorMessage(error, fallbackMessage);
  if (options.description === undefined) {
    toast.error(text);
  } else {
    toast.error(text, { description: options.description });
  }
  return true;
}
