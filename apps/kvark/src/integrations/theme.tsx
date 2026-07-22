import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    mounted: boolean;
    toggleTheme: () => void;
};

export const THEME_STORAGE_KEY = "kvark-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readTheme(): Theme {
    return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // The inline script in __root.tsx applied the theme class before
        // hydration — adopt it as the source of truth for React state.
        setTheme(readTheme());
        setMounted(true);
    }, []);

    // The class on <html> is derived from state, never toggled ad hoc. This
    // re-applies it after anything outside our control (e.g. React recovering
    // from a hydration error re-renders <html> and drops attributes it does
    // not own) has wiped it.
    useEffect(() => {
        if (!mounted) {
            return;
        }
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");

        // Guard against external wipes between renders: if the class list is
        // mutated to disagree with state, restore it.
        const observer = new MutationObserver(() => {
            const hasDark = root.classList.contains("dark");
            if (hasDark !== (theme === "dark")) {
                root.classList.toggle("dark", theme === "dark");
            }
        });
        observer.observe(root, {
            attributes: true,
            attributeFilter: ["class"],
        });
        return () => observer.disconnect();
    }, [theme, mounted]);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            window.localStorage.setItem(THEME_STORAGE_KEY, next);
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({ theme, mounted, toggleTheme }),
        [theme, mounted, toggleTheme],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return ctx;
}
