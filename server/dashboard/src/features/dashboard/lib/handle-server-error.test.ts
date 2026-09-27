import { beforeEach, describe, expect, it, vi } from "vitest";

// sonner 的 toast 在 jsdom 里会尝试挂载 DOM，这里只关心是否被调用
vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { toast } from "sonner";

import {
  handleServerError,
  isErrorHandled,
  markErrorHandled,
} from "./handle-server-error";

const toastError = vi.mocked(toast.error);

beforeEach(() => {
  toastError.mockClear();
});

describe("handleServerError 去重", () => {
  it("首次调用会提示", () => {
    const error = new Error("boom");
    expect(handleServerError(error)).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("boom");
  });

  it("同一个错误对象重复调用只提示一次", () => {
    const error = new Error("boom");
    handleServerError(error);
    handleServerError(error);
    handleServerError(error);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("不同错误对象各自提示", () => {
    handleServerError(new Error("a"));
    handleServerError(new Error("b"));
    expect(toastError).toHaveBeenCalledTimes(2);
  });

  it("markErrorHandled 后不再提示", () => {
    const error = new Error("boom");
    markErrorHandled(error);
    expect(handleServerError(error)).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("cause 相同的错误被视为同一个", () => {
    const cause = new Error("root cause");
    const outer = new Error("outer", { cause });

    handleServerError(outer);
    // 另一个包装了同一 cause 的错误
    const sibling = new Error("sibling", { cause });
    expect(handleServerError(sibling)).toBe(false);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("isErrorHandled 反映标记状态", () => {
    const error = new Error("boom");
    expect(isErrorHandled(error)).toBe(false);
    handleServerError(error);
    expect(isErrorHandled(error)).toBe(true);
  });
});

describe("handleServerError 文案", () => {
  it("优先用显式传入的 message", () => {
    handleServerError(new Error("原始错误"), "兜底", { message: "自定义文案" });
    expect(toastError).toHaveBeenCalledWith("自定义文案");
  });

  it("带 description 时用双参形式", () => {
    handleServerError(new Error("boom"), "兜底", { description: "补充说明" });
    expect(toastError).toHaveBeenCalledWith("boom", { description: "补充说明" });
  });

  it("无法解析时用兜底文案", () => {
    handleServerError({}, "兜底文案");
    // {} 没有 message，getErrorMessage 会返回 fallback
    expect(toastError).toHaveBeenCalledWith("兜底文案");
  });

  it("字符串错误可直接使用", () => {
    handleServerError("直接的错误信息");
    expect(toastError).toHaveBeenCalledWith("直接的错误信息");
  });
});

describe("原始值错误", () => {
  it("字符串错误无法去重，每次都会提示", () => {
    // 记录这个已知限制：WeakSet 只接受对象
    handleServerError("同样的字符串");
    handleServerError("同样的字符串");
    expect(toastError).toHaveBeenCalledTimes(2);
  });

  it("null / undefined 不抛异常", () => {
    expect(() => handleServerError(null)).not.toThrow();
    expect(() => handleServerError(undefined)).not.toThrow();
  });
});
