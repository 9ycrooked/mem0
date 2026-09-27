import "@/styles/globals.css";
import React from "react";
import { Inter, InterDisplay, Roboto, Fustat, DMMono } from "../(root)/fonts";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import { getServerLanguage } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";

export const metadata = {
  title: "Mem0 - Log in",
  description: "Log in to Mem0",
};

// 自维护 fork：(auth) 与 (root) 是平行路由组，各自渲染独立的 <html>，
// 因此两边的 layout 都要接 i18n Provider，否则 /login 之类的页面拿不到翻译。
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const language = await getServerLanguage();
  return (
    <html
      lang={language}
      className={cn(
        Fustat.variable,
        InterDisplay.variable,
        Inter.variable,
        Roboto.variable,
        DMMono.variable,
      )}
      suppressHydrationWarning
    >
      <body className="font-fustat" suppressHydrationWarning>
        <AuthProvider>
          <I18nProvider initialLanguage={language}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
