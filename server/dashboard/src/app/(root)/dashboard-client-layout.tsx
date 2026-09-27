"use client";

import React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import { ClientLayout } from "./clientLayout";
import { cn } from "@/lib/utils";
import { Inter, InterDisplay, Roboto, Fustat, DMMono } from "./fonts";
import { Provider } from "react-redux";
import store from "@/store/store";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/i18n/provider";
import type { LanguageCode } from "@/i18n/languages";
import dynamic from "next/dynamic";

const Toaster = dynamic(
  () =>
    import("@/components/ui/sonner").then((mod) => ({ default: mod.Toaster })),
  {
    ssr: false,
  },
);

export function DashboardClientLayout({
  children,
  language,
}: Readonly<{
  children: React.ReactNode;
  language: LanguageCode;
}>) {
  return (
    <html lang={language} suppressHydrationWarning>
      <body
        className={cn(
          Inter.className,
          InterDisplay.variable,
          Roboto.variable,
          Fustat.variable,
          DMMono.variable,
        )}
        suppressHydrationWarning
      >
        <Provider store={store}>
          <AuthProvider>
            <I18nProvider initialLanguage={language}>
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem
                disableTransitionOnChange
              >
                <ClientLayout>{children}</ClientLayout>
                <Toaster />
              </ThemeProvider>
            </I18nProvider>
          </AuthProvider>
        </Provider>
      </body>
    </html>
  );
}
