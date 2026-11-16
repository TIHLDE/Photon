/**
 * Colours for the email templates. Kept in step with the light theme in
 * `packages/ui/src/styles.css` — email clients cannot read CSS variables, so
 * the values are spelled out here.
 */
export const colors = {
    /** TIHLDE logo blue, `--logo` / `--primary` on the website. */
    brand: "#1c458a",
    canvas: "#f3f4f6",
    surface: "#ffffff",
    border: "#e5e7eb",
    panel: "#f7f8fa",
    panelBorder: "#e8eaee",
    heading: "#111827",
    text: "#374151",
    muted: "#6b7280",
    subtle: "#9ca3af",
    danger: "#b91c1c",
    dangerTint: "#fef2f2",
    dangerBorder: "#fecaca",
} as const;

export const fontFamily =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";
