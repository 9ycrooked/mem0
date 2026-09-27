"use client";

/**
 * VChart 封装。
 *
 * 自维护 fork 新增。解决三件接入 VChart 必须处理的事：
 *
 * 1. **SSR**：VChart 依赖 DOM，必须只在客户端加载。用 next/dynamic + ssr:false，
 *    否则 `next build` 会在预渲染时报错。
 * 2. **主题接线**：VChart 用 ThemeManager 全局设一次主题，而本项目用
 *    next-themes 的 attribute="class"，主题信息在 html 的 class 上。
 *    这里用 useTheme() 读 resolvedTheme，并在变化时同步给 VChart。
 * 3. **容器尺寸**：给固定高度，避免 VChart 首次测量时高度为 0。
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type {
  IAreaChartSpec,
  IBarChartSpec,
  IPieChartSpec,
} from "@visactor/react-vchart";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChartTheme } from "../lib/chart-specs";

/** VChart 主题名与 ThemeManager 的约定值。 */
const VCHART_THEME: Record<ChartTheme, string> = {
  light: "light",
  dark: "dark",
};

/** 只在客户端加载，避免服务端渲染报错。 */
const VChart = dynamic(
  () => import("@visactor/react-vchart").then((mod) => ({ default: mod.VChart })),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full" />,
  },
);

export interface ChartProps {
  /** VChart spec（由 lib/chart-specs.ts 的纯函数生成）。 */
  spec: IPieChartSpec | IAreaChartSpec | IBarChartSpec;
  /** 容器高度类，默认 h-64。 */
  className?: string;
  /** 数据为空时显示的替代内容。 */
  emptyFallback?: React.ReactNode;
  /** 传给 VChart 的额外配置。 */
  options?: Record<string, unknown>;
  /** 是否禁用动画（测试或大量图表时）。 */
  disableAnimation?: boolean;
}

export function Chart({
  spec,
  className,
  emptyFallback,
  options,
  disableAnimation = false,
}: ChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // 主题要在挂载后才能读到（服务端没有 window.matchMedia）
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const theme: ChartTheme = resolvedTheme === "dark" ? "dark" : "light";

  // VChart 的全局主题只需设一次，但它要求 theme 已注册；
  // 这里用 spec 上的 theme 字段代替全局设置，效果等价且无需管理注册时序。
  const themedSpec = React.useMemo(
    () =>
      ({
        ...spec,
        theme: VCHART_THEME[theme],
        ...(disableAnimation ? { animation: false } : {}),
      }) as IPieChartSpec | IAreaChartSpec | IBarChartSpec,
    [spec, theme, disableAnimation],
  );

  // 数据为空时不必挂载图表实例
  const values = (spec.data as { values?: unknown[] }[] | undefined)?.[0]?.values;
  if (Array.isArray(values) && values.length === 0 && emptyFallback !== undefined) {
    return <div className={cn("h-64", className)}>{emptyFallback}</div>;
  }

  if (!mounted) {
    return (
      <div className={cn("h-64", className)}>
        <Skeleton className="size-full" />
      </div>
    );
  }

  return (
    <div className={cn("h-64", className)}>
      <VChart spec={themedSpec} options={options} />
    </div>
  );
}
