import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

export type Theme = "light" | "dark";

export const getTheme = createIsomorphicFn()
  .server(() => {
    const theme = getCookie("theme");
    return (theme === "light" ? "light" : "dark") satisfies Theme;
  })
  .client(() => {
    const match = document.cookie.match(/theme=(light|dark)/);
    return (match?.[1] === "light" ? "light" : "dark") satisfies Theme;
  });

export const setTheme = createIsomorphicFn().client((theme: Theme) => {
  document.cookie = `theme=${theme};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
});

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setThemeCallback = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.className = newTheme;
    setTheme(newTheme);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme: setThemeCallback }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
