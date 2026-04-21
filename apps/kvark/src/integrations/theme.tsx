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
        setTheme(readTheme());
        setMounted(true);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            document.documentElement.classList.toggle("dark", next === "dark");
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
