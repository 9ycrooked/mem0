"use client";

/**
 * SectionPageLayout：统一的页面骨架。
 *
 * 自维护 fork 新增。设计参考 new-api 的
 * `layout/section-page-layout.tsx` 的 slot 复合组件模式：
 * 子组件本身渲染 null，父组件用 Children.forEach + isValidElement 按组件类型
 * 抽取各个槽位。这样调用方是按语义写的，而不是往一堆 props 里塞 JSX。
 *
 * 与参考实现的差异：**不引入 footer portal**。参考实现用 Portal 把页面按钮
 * 传送到布局底部的粘性栏，本项目页面简单，不需要这层间接。
 */

import * as React from "react";

import { cn } from "@/lib/utils";

interface SlotProps {
  children?: React.ReactNode;
}

/** 页面标题。 */
function SectionPageTitle(_props: SlotProps) {
  return null;
}
/** 标题右侧的操作区。 */
function SectionPageActions(_props: SlotProps) {
  return null;
}
/** 页面主体内容。 */
function SectionPageContent(_props: SlotProps) {
  return null;
}

export interface SectionPageLayoutProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * 内容区固定高度（表格页用）。
   * 默认内容区自身滚动。
   */
  fixedContent?: boolean;
}

export function SectionPageLayout({
  children,
  className,
  fixedContent = false,
}: SectionPageLayoutProps) {
  let title: React.ReactNode;
  let actions: React.ReactNode;
  let content: React.ReactNode;

  React.Children.forEach(children, (node) => {
    if (!React.isValidElement(node)) return;
    const child = node as React.ReactElement<SlotProps>;
    if (child.type === SectionPageTitle) title = child.props.children;
    else if (child.type === SectionPageActions) actions = child.props.children;
    else if (child.type === SectionPageContent) content = child.props.children;
  });

  const hasHeader = title !== undefined || actions !== undefined;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {hasHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          {title === undefined ? null : (
            <h1 className="text-xl font-semibold text-onSurface-default-primary">{title}</h1>
          )}
          {actions === undefined ? null : (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1",
          fixedContent ? "overflow-hidden" : "overflow-auto",
        )}
      >
        {content}
      </div>
    </div>
  );
}

SectionPageLayout.Title = SectionPageTitle;
SectionPageLayout.Actions = SectionPageActions;
SectionPageLayout.Content = SectionPageContent;
