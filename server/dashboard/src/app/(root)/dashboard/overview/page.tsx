import type { Metadata } from "next";

import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";

export const metadata: Metadata = {
  title: "Dashboard | Mem0",
  description: "Overview of the memory system",
};

/**
 * 仪表盘首页。
 *
 * 自维护 fork 新增。middleware 把 / 与 /dashboard 重定向到这里；
 * /dashboard/requests 保持原样，仍可从侧边栏进入。
 */
export default function DashboardOverviewPage() {
  return <DashboardOverview />;
}
