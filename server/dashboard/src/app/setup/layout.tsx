import "@/styles/globals.css";
import { Inter, Fustat, Roboto, DMMono, InterDisplay } from "../(root)/fonts";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import { getServerLanguage } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";

export const metadata = {
  title: "Setup | Mem0",
  description: "Set up your Mem0 instance",
};

// 自维护 fork：setup 也是独立路由组，自带 <html>，需单独接 i18n。
export default async function SetupLayout({
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
              defaultTheme="light"
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
