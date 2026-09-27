import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * 自维护 fork 新增：测试配置。
 * 上游 dashboard 无任何测试基础设施，此文件与所有 *.test.ts(x) 均为本地新增。
 *
 * 约定：纯逻辑放在 lib/ 下用纯函数实现并单独测试；
 * 组件测试用 @testing-library/react + jsdom。
 *
 * 用 .mts 扩展名：package.json 未声明 "type": "module"，
 * 而 Vite 未来主版本会把 configLoader 默认切到 native，届时 .ts 里的 ESM 语法会报错。
 * 因此这里用 import.meta.url 而不是 __dirname。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 与 tsconfig.json 的 paths 保持一致
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.mts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // 样式文件在测试里没有意义，直接跳过解析
    css: false,
  },
});
