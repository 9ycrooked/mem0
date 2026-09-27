import { Metadata } from "next";
import { DashboardClientLayout } from "./dashboard-client-layout";
import { getServerLanguage } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Dashboard | Mem0",
  description: "Mem0 Dashboard",
};

// 自维护 fork：在服务端解析界面语言（cookie > Accept-Language > 默认），
// 传给客户端 Provider，保证首屏语言正确、不出现 hydration 不一致。
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getServerLanguage();
  return (
    <DashboardClientLayout language={language}>{children}</DashboardClientLayout>
  );
}
