"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ChartLine,
  ChevronDown,
  FolderInput,
  GalleryVerticalEnd,
  KeyRound,
  Settings,
  Tags,
  Users,
  WebhookIcon,
  Wrench,
} from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * 自维护 fork 开关：是否在侧边栏显示官方的 CLOUD FEATURES 分组。
 * 该分组四项均为 LockedPage 占位页（假数据预览 + 跳转 Mem0 Cloud 的推广按钮），
 * 自托管用户用不到。改为 true 即恢复官方行为。
 */
const SHOW_CLOUD_FEATURES = false;

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();
  const isSidebarCollapsed = useSelector(
    (state: RootState) => state.layout.isSidebarCollapsed,
  );
  const [isCloudOpen, setIsCloudOpen] = React.useState(true);

  return (
    <Sidebar
      collapsible={isSidebarCollapsed ? "icon" : undefined}
      className={cn(className, "border-r-0 w-full mb-0 bg-transparent")}
      {...props}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-0">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0">
                {!isSidebarCollapsed && (
                  <SidebarGroupLabel className="mb-0">
                    ACTIVITY
                  </SidebarGroupLabel>
                )}
                {[
                  {
                    title: "Requests",
                    url: "/dashboard/requests",
                    icon: Activity,
                    active: pathname === "/dashboard/requests",
                  },
                  {
                    title: "Memories",
                    url: "/dashboard/memories",
                    icon: GalleryVerticalEnd,
                    active: pathname === "/dashboard/memories",
                  },
                  {
                    title: "Entities",
                    url: "/dashboard/entities",
                    icon: Users,
                    active: pathname === "/dashboard/entities",
                  },
                ].map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      collapsed={isSidebarCollapsed}
                      active={item.active}
                      tooltip={isSidebarCollapsed ? item.title : undefined}
                    >
                      <Link
                        href={item.url}
                        className={cn(
                          "flex items-center w-full",
                          isSidebarCollapsed
                            ? "justify-center mx-auto"
                            : "gap-1.5",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {!isSidebarCollapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </div>

              {isSidebarCollapsed && (
                <div className="h-[1px] w-full bg-memBorder-primary my-2" />
              )}

              {/* 自维护改动：官方在此展示 CLOUD FEATURES（Categories / Webhooks /
                  Analytics / Export 四项），均为 LockedPage 占位页 —— 内容是手绘假数据，
                  唯一可点按钮指向 Mem0 Cloud 注册（带 UTM 埋点）。自托管场景下无用，
                  故以开关隐藏。置 true 可恢复官方行为。 */}
              {SHOW_CLOUD_FEATURES && (
              <Collapsible
                open={isCloudOpen}
                onOpenChange={setIsCloudOpen}
                className="flex flex-col gap-0"
              >
                {!isSidebarCollapsed && (
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="cursor-pointer mb-0">
                      CLOUD FEATURES
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform duration-200",
                          isCloudOpen ? "" : "-rotate-90",
                        )}
                      />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent className="flex flex-col gap-0">
                  {[
                    {
                      title: "Categories",
                      url: "/dashboard/categories",
                      icon: Tags,
                    },
                    {
                      title: "Webhooks",
                      url: "/dashboard/webhooks",
                      icon: WebhookIcon,
                    },
                    {
                      title: "Analytics",
                      url: "/dashboard/analytics",
                      icon: ChartLine,
                    },
                    {
                      title: "Export",
                      url: "/dashboard/export",
                      icon: FolderInput,
                    },
                  ].map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        collapsed={isSidebarCollapsed}
                        active={pathname === item.url}
                        tooltip={isSidebarCollapsed ? item.title : undefined}
                      >
                        <Link
                          href={item.url}
                          className={cn(
                            "flex items-center w-full",
                            isSidebarCollapsed
                              ? "justify-center mx-auto"
                              : "gap-1.5",
                          )}
                        >
                          <item.icon className="size-4 shrink-0" />
                          {!isSidebarCollapsed && (
                            <>
                              <span>{item.title}</span>
                              <Badge
                                variant="outline"
                                className="ml-auto text-memGold-600 border-memGold-300 typo-caption-sm px-1.5 py-0"
                              >
                                PRO
                              </Badge>
                            </>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </CollapsibleContent>
              </Collapsible>
              )}

              {isSidebarCollapsed && (
                <div className="h-[1px] w-full bg-memBorder-primary my-2" />
              )}

              <div className="flex flex-col gap-0">
                {!isSidebarCollapsed && (
                  <SidebarGroupLabel className="mb-0">
                    ACCOUNT
                  </SidebarGroupLabel>
                )}
                {[
                  {
                    title: "API Keys",
                    url: "/dashboard/api-keys",
                    icon: KeyRound,
                    active: pathname === "/dashboard/api-keys",
                  },
                  {
                    title: "Configuration",
                    url: "/dashboard/configuration",
                    icon: Wrench,
                    active: pathname === "/dashboard/configuration",
                  },
                  {
                    title: "Settings",
                    url: "/dashboard/settings",
                    icon: Settings,
                    active: pathname === "/dashboard/settings",
                  },
                ].map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      collapsed={isSidebarCollapsed}
                      active={item.active}
                      tooltip={isSidebarCollapsed ? item.title : undefined}
                    >
                      <Link
                        href={item.url}
                        className={cn(
                          "flex items-center w-full",
                          isSidebarCollapsed
                            ? "justify-center mx-auto"
                            : "gap-1.5",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {!isSidebarCollapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </div>
            </div>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
