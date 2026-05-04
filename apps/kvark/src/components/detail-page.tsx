import type { ReactNode } from "react";

type DetailPageProps = {
    back?: ReactNode;
    hero?: ReactNode;
    header: ReactNode;
    sidebar?: ReactNode;
    body: ReactNode;
};

export function DetailPage({
    back,
    hero,
    header,
    sidebar,
    body,
}: DetailPageProps) {
    return (
        <article className="container mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
            {back}
            {hero}
            {sidebar ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:gap-8">
                    <header className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
                        {header}
                    </header>
                    <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start">
                        {sidebar}
                    </aside>
                    <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
                        {body}
                    </div>
                </div>
            ) : (
                <>
                    <header className="flex flex-col gap-4">{header}</header>
                    <div className="flex flex-col gap-6">{body}</div>
                </>
            )}
        </article>
    );
}
