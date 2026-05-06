import { createFileRoute } from "@tanstack/react-router";

import { IssueCard, type IssueCardProps } from "#/components/issue-card";

export const Route = createFileRoute("/_app/toddel")({ component: ToddelPage });

const ISSUES: IssueCardProps[] = [
    { title: "TÖDDEL #48", edition: "Høst 2025" },
    { title: "TÖDDEL #47", edition: "Vår 2025" },
    { title: "TÖDDEL #46", edition: "Høst 2024" },
    { title: "TÖDDEL #45", edition: "Vår 2024" },
    { title: "TÖDDEL #44", edition: "Høst 2023" },
    { title: "TÖDDEL #43", edition: "Vår 2023" },
    { title: "TÖDDEL #42", edition: "Høst 2022" },
    { title: "TÖDDEL Jubileum", edition: "2022" },
    { title: "TÖDDEL #41", edition: "Vår 2022" },
    { title: "TÖDDEL #40", edition: "Høst 2021" },
    { title: "TÖDDEL #39", edition: "Vår 2021" },
    { title: "TÖDDEL #38", edition: "Høst 2020" },
    { title: "Studentlivet i TIHLDE", edition: "Spesialutgave 2020" },
    { title: "There is us", edition: "Spesialutgave 2019" },
    { title: "TÖDDEL #37", edition: "Vår 2019" },
    { title: "TÖDDEL #36", edition: "Høst 2018" },
    { title: "TÖDDEL #35", edition: "Vår 2018" },
    { title: "TÖDDEL #34", edition: "Høst 2017" },
];

function ToddelPage() {
    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">TÖDDEL</h1>
                <p className="text-muted-foreground">
                    Les tidligere utgaver av TIHLDE sitt studentblad
                </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {ISSUES.map((issue) => (
                    // TODO: replace with a unique id field once wired up to the backend
                    <li key={issue.title}>
                        <IssueCard {...issue} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
