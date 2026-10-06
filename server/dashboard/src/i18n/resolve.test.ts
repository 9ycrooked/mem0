import { describe, expect, it } from "vitest";

import { createClientI18n } from "./config";

/**
 * 真实解析验证。
 *
 * 之前的 key-usage.test.ts 是**静态**检查（源码里的 key 是否在字典里存在），
 * 它能发现拼写与命名空间错误，但不能证明 i18next 运行时真的解析得出中文。
 *
 * 这个测试在真实 i18next 实例上解析关键 key，失败时会把 key 原样返回 ——
 * 那正是界面上显示 "settings.title" 这种字面量的原因。
 */

const i18n = createClientI18n("zh");

/** 解析一个 key，返回结果。 */
function resolve(key: string, ns?: string): string {
  return i18n.t(key, ns === undefined ? undefined : { ns });
}

describe("中文解析", () => {
  it("pages 命名空间的设置页 key", () => {
    expect(resolve("settings.title", "pages")).toBe("设置");
    expect(resolve("settings.profile", "pages")).toBe("个人信息");
    expect(resolve("settings.name", "pages")).toBe("名称");
    expect(resolve("settings.email", "pages")).toBe("邮箱");
    expect(resolve("settings.saveProfile", "pages")).toBe("保存");
    expect(resolve("settings.currentPassword", "pages")).toBe("当前密码");
    expect(resolve("settings.newPassword", "pages")).toBe("新密码");
    expect(resolve("settings.confirmPassword", "pages")).toBe("确认新密码");
    expect(resolve("settings.passwordPlaceholder", "pages")).toBe("至少 8 位");
    expect(resolve("settings.updatePassword", "pages")).toBe("修改密码");
    expect(resolve("settings.appearance", "pages")).toBe("外观");
    expect(resolve("settings.theme", "pages")).toBe("主题");
  });

  it("pages 命名空间的请求记录 key", () => {
    expect(resolve("requests.title", "pages")).toBe("请求记录");
    expect(resolve("requests.statsTotal", "pages")).toBe("总请求数");
    expect(resolve("requests.statsSuccessRate", "pages")).toBe("成功率");
    expect(resolve("requests.colAuth", "pages")).toBe("认证方式");
    expect(resolve("requests.authApiKey", "pages")).toBe("API 密钥");
    expect(resolve("requests.emptyTitle", "pages")).toBe("还没有请求记录");
  });

  it("common 命名空间的通用 key", () => {
    expect(resolve("action.refresh", "common")).toBe("刷新");
    expect(resolve("action.loading", "common")).toBe("加载中…");
    expect(resolve("language.label", "common")).toBe("界面语言");
    expect(resolve("nav.dashboard", "common")).toBe("仪表盘");
  });

  it("dashboard 命名空间", () => {
    expect(resolve("title", "dashboard")).toBe("仪表盘");
    // 2026-10-06：记忆卡片改为「有效记忆」口径（不含归档），并新增记忆状态面板
    expect(resolve("metrics.memories", "dashboard")).toBe("有效记忆");
    expect(resolve("metrics.archived", "dashboard")).toBe("归档");
    expect(resolve("panels.status.title", "dashboard")).toBe("记忆状态");
  });

  it("auth 命名空间", () => {
    expect(resolve("login.title", "auth")).toBe("登录 Mem0");
    expect(resolve("login.email", "auth")).toBe("邮箱");
  });

  it("带插值的 key 正常工作", () => {
    const out = resolve("requests.lastUpdated", "pages");
    // 未传插值变量时应保留占位符而不是崩掉
    expect(out).toContain("{{time}}");
  });

  it("不存在的 key 会原样返回（这正是要避免的现象）", () => {
    // 记录 i18next 的行为：找不到 key 不报错，返回 key 本身。
    // 界面因此显示字面量，而类型检查与构建都不会失败 —— 所以需要静态检查兜底。
    expect(resolve("settings.doesNotExist", "pages")).toBe("settings.doesNotExist");
  });

  it("英文解析也能工作（回退语言）", () => {
    const en = createClientI18n("en");
    expect(en.t("settings.title", { ns: "pages" })).toBe("Settings");
    expect(en.t("action.refresh", { ns: "common" })).toBe("Refresh");
  });
});
