import { Button } from "@tihlde/ui/ui/button";
import { Moon, Sun } from "lucide-react";
import type { ComponentProps } from "react";

import { useTheme } from "#/integrations/theme";

type ThemeSwitcherProps = Omit<
    ComponentProps<typeof Button>,
    "aria-label" | "children" | "onClick" | "size" | "variant"
>;

export function ThemeSwitcher(props: ThemeSwitcherProps) {
    const { theme, mounted, toggleTheme } = useTheme();

    return (
        <Button
            {...props}
            variant="ghost"
            size="icon"
            aria-label="Bytt tema"
            onClick={toggleTheme}
        >
            {mounted ? theme === "dark" ? <Sun /> : <Moon /> : null}
        </Button>
    );
}
