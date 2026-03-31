import { useTheme } from "#/lib/theme";

const MODES = ["light", "dark"] as const;

const LABELS = {
  light: "Light",
  dark: "Dark",
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function toggleMode() {
    const nextMode = MODES[(MODES.indexOf(theme) + 1) % MODES.length];
    setTheme(nextMode);
  }

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={theme}
      title={theme}
      className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5"
    >
      {LABELS[theme]}
    </button>
  );
}
