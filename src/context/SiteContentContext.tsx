import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { fetchSiteBundle } from "@/server/site-content.functions";
import { siteDefaults, type SiteDefaults } from "@/lib/site-defaults";
import type { CustomPage } from "@/server/site-content.functions";

export type SiteContentBundle = {
  content: SiteDefaults;
  pages: CustomPage[];
};

type ContentValue = {
  content: SiteDefaults;
  pages: CustomPage[];
  refresh: () => Promise<void>;
};

const Ctx = createContext<ContentValue | null>(null);

export function SiteContentProvider({ children, initialBundle }: { children: ReactNode; initialBundle?: SiteContentBundle }) {
  const [content, setContent] = useState<SiteDefaults>(initialBundle?.content ?? siteDefaults);
  const [pages, setPages] = useState<CustomPage[]>(initialBundle?.pages ?? []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchSiteBundle();
      setContent(res.content);
      setPages(res.pages);
    } catch (e) {
      console.error("[site-content] failed to load:", e);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ content, pages, refresh }}>{children}</Ctx.Provider>;
}

export function useSiteContent(): SiteDefaults {
  const v = useContext(Ctx);
  return v?.content ?? siteDefaults;
}

export function useCustomPages(): CustomPage[] {
  const v = useContext(Ctx);
  return v?.pages ?? [];
}

export function useSiteContentRefresh() {
  const v = useContext(Ctx);
  return v?.refresh ?? (async () => {});
}
