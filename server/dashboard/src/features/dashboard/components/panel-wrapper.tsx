"use client";

/**
 * PanelWrapper：统一的分区容器，把 loading / empty / children 三种状态收在一处分发。
 *
 * 自维护 fork 新增。设计参考 new-api 的
 * `features/dashboard/components/ui/panel-wrapper.tsx`。
 *
 * 关键点：loading 与 empty 都占用与真实内容**相同的高度**，避免数据到达时布局跳动。
 * 这也是参考实现强调的（其 height 默认 h-64）。
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface PanelWrapperProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** 右上角的操作区。 */
  headerActions?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: React.ReactNode;
  /** 内容区高度类，默认 h-64。loading / empty 复用同一高度以防跳动。 */
  height?: string;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
}

export function PanelWrapper({
  title,
  description,
  headerActions,
  loading = false,
  empty = false,
  emptyMessage,
  height = "h-64",
  className,
  contentClassName,
  children,
}: PanelWrapperProps) {
  const frameClassName = cn(
    "overflow-hidden rounded-xl border bg-surface-default-primary border-memBorder-primary",
    className,
  );

  const header =
    title === undefined && description === undefined && headerActions === undefined ? null : (
      <div className="flex items-start justify-between gap-3 border-b border-memBorder-primary px-4 py-3 sm:px-5">
        <div className="min-w-0">
          {title === undefined ? null : (
            <div className="truncate text-sm font-medium text-onSurface-default-primary">
              {title}
            </div>
          )}
          {description === undefined ? null : (
            <div className="mt-0.5 text-xs text-onSurface-default-secondary">
              {description}
            </div>
          )}
        </div>
        {headerActions === undefined ? null : (
          <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
        )}
      </div>
    );

  if (loading) {
    return (
      <div className={frameClassName}>
        {header}
        <div className={cn("p-4 sm:p-5", contentClassName)}>
          <Skeleton className={cn("w-full", height)} />
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={frameClassName}>
        {header}
        <div
          className={cn(
            "flex items-center justify-center px-4 text-sm text-onSurface-default-tertiary",
            height,
            contentClassName,
          )}
        >
          {emptyMessage ?? "—"}
        </div>
      </div>
    );
  }

  return (
    <div className={frameClassName}>
      {header}
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </div>
  );
}
