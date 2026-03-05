import { cn } from "~/lib/utils";

type PageProps = {
    children: React.ReactNode;
    className?: string;
};

export function Page({ children, className }: PageProps) {
    return (
        <main
            className={cn(
                "mx-auto w-full max-w-7xl px-4 py-20 md:px-12 md:py-28",
                className,
            )}
        >
            {children}
        </main>
    );
}
