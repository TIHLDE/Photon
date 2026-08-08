import type { ReactNode } from "react";

type DetailPageProps = {
    back?: ReactNode;
    hero?: ReactNode;
    header: ReactNode;
    sidebar?: ReactNode;
    body?: ReactNode;
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
                // `min-w-0` på hvert grid-barn: uten det får de automatisk
                // minstebredde lik sitt eget min-content, og da vokser
                // headeren forbi kolonna så snart et gruppenavn eller en
                // tittel er lang. Sporet er allerede minmax(0,1fr) — det er
                // barna som mangler tillatelsen til å krympe.
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
                    <header className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
                        {header}
                    </header>
                    <aside className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start">
                        {sidebar}
                    </aside>
                    <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-2">
                        {body}
                    </div>
                </div>
            ) : (
                <>
                    <header className="flex min-w-0 flex-col gap-4">
                        {header}
                    </header>
                    <div className="flex min-w-0 flex-col gap-6">{body}</div>
                </>
            )}
        </article>
    );
}
