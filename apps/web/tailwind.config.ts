import type { Config } from "tailwindcss";

export default {
    darkMode: "media",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        ".src/app/components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: "var(--primary)",
            },
        },
    },
    plugins: [],
} satisfies Config;
