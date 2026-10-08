import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import type { Fine } from "#/lib/group";
import { GroupFinesTab } from "./group-fines-tab";

const linkedFine: Fine = {
    id: "9f3464b3-1ee6-4dd0-8a02-e17a72bff4af",
    userId: "recipient",
    user: "Recipient",
    lawId: "ec779b6e-bd82-49b4-a0d6-3137527129ae",
    paragraph: "1.02",
    title: "For sent til møte",
    hasLaw: true,
    amount: 2,
    status: "pending",
    approved: false,
    paid: false,
    createdBy: "Giver",
    date: "2026-10-08T10:00:00.000Z",
    reason: "Begrunnelsen for den lenkede boten",
    defense: "",
};

const ignore = () => {};

function render(overrides: Partial<ComponentProps<typeof GroupFinesTab>>) {
    return renderToStaticMarkup(
        <GroupFinesTab
            groupSlug="index"
            fines={[]}
            fineUsers={[]}
            memberCount={1}
            grouping="alle"
            onGroupingChange={ignore}
            status="alle"
            onStatusChange={ignore}
            onSelectUser={ignore}
            hasMore={false}
            isLoadingMore={false}
            onLoadMore={ignore}
            canManage={false}
            onApprove={ignore}
            onMarkPaid={ignore}
            onEdit={ignore}
            onDelete={ignore}
            onSaveDefense={() => Promise.resolve()}
            onSettleAllForUser={ignore}
            onFineRevealed={ignore}
            hasPreviousFines={false}
            isLoadingPreviousFines={false}
            onLoadPreviousFines={ignore}
            onShowNewestFines={ignore}
            {...overrides}
        />,
    );
}

describe("fine list jump", () => {
    test.each(["alle", "per-medlem"] as const)(
        "opens a filtered fine in the %s view",
        (grouping) => {
            const html = render({
                grouping,
                showFineList: true,
                status: "pending",
                selectedUserId: linkedFine.userId,
                selectedUserName: linkedFine.user,
                revealFineId: linkedFine.id,
                fines: [linkedFine],
                hasPreviousFines: true,
                hasMore: true,
            });
            expect(html).toContain('aria-expanded="true"');
            expect(html).toContain(linkedFine.reason);
            expect(html).toContain(`Viser bøter for ${linkedFine.user}`);
            expect(html).toContain("Last inn nyere bøter");
            expect(html).toContain("Last inn mer");
            if (grouping === "per-medlem") {
                expect(html).toContain("Til medlemsoversikten");
                expect(html).toMatch(
                    /aria-selected="true"[^>]*>Per medlem<\/button>/,
                );
            }
        },
    );

    test.each(["alle", "per-medlem"] as const)(
        "renders the fallback page without expanding a different fine in the %s view",
        (grouping) => {
            const html = render({
                grouping,
                showFineList: true,
                revealFineId: linkedFine.id,
                fines: [{ ...linkedFine, id: "another-fine" }],
                selectedUserId: linkedFine.userId,
            });
            expect(html).toContain('data-fine-id="another-fine"');
            expect(html).not.toContain('aria-expanded="true"');
            expect(html).not.toContain("Kunne ikke hente bøtene");
            expect(html).not.toContain(linkedFine.reason);
        },
    );

    test.each(["alle", "per-medlem"] as const)(
        "uses the ordinary empty state when the fallback has no matches in the %s view",
        (grouping) => {
            const html = render({
                grouping,
                showFineList: true,
                revealFineId: linkedFine.id,
            });
            expect(html).toContain("Fant ingen bøter");
            expect(html).not.toContain("Kunne ikke hente bøtene");
        },
    );

    test.each(["alle", "per-medlem"] as const)(
        "keeps fine details hidden after an access error in the %s view",
        (grouping) => {
            const html = render({
                grouping,
                showFineList: true,
                revealFineId: linkedFine.id,
                fines: [linkedFine],
                finesError: "Du har ikke tilgang til disse bøtene.",
            });
            expect(html).toContain("Du har ikke tilgang til disse bøtene.");
            expect(html).not.toContain(linkedFine.reason);
            expect(html).not.toContain("data-fine-id=");
        },
    );

    test("keeps the member overview when no fine or recipient is selected", () => {
        const html = render({ grouping: "per-medlem", fines: [linkedFine] });
        expect(html).not.toContain("data-fine-id=");
        expect(html).not.toContain("Til medlemsoversikten");
    });

    test("opens the requested row inside the ordinary list", () => {
        const html = render({
            revealFineId: linkedFine.id,
            fines: [linkedFine],
        });
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain(linkedFine.reason);
        expect(html.match(/data-fine-id=/g)).toHaveLength(1);
    });

    test("renders the selected fine once alongside its neighbours", () => {
        const html = render({
            revealFineId: linkedFine.id,
            fines: [
                linkedFine,
                { ...linkedFine, id: "neighbour", reason: "Another fine" },
            ],
        });
        expect(html.match(/data-slot="accordion-trigger"/g)).toHaveLength(2);
        expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
        expect(html).not.toContain("Fant ingen bøter");
    });

    test("can load both newer and older pages after a jump", () => {
        const html = render({
            fines: [linkedFine],
            hasPreviousFines: true,
            hasMore: true,
        });
        expect(html).toContain("Last inn mer");
        expect(html).toContain("Last inn nyere bøter");
        expect(html).toContain("Til nyeste bøter");
    });

    test("hides newer-page controls at the beginning of the list", () => {
        const html = render({ fines: [linkedFine] });
        expect(html).not.toContain("Last inn nyere bøter");
        expect(html).not.toContain("Til nyeste bøter");
    });

    test("does not fetch opposite directions concurrently", () => {
        for (const loading of [
            { isLoadingPreviousFines: true },
            { isLoadingMore: true },
        ]) {
            const html = render({
                fines: [linkedFine],
                hasPreviousFines: true,
                hasMore: true,
                ...loading,
            });
            expect(html.match(/\sdisabled=""/g)).toHaveLength(3);
        }
    });

    test("does not remember an expanded fine on a normal visit", () => {
        const html = render({ fines: [linkedFine] });
        expect(html).not.toContain('aria-expanded="true"');
    });

    test("shows a skeleton while the linked fine loads", () => {
        const html = render({
            revealFineId: linkedFine.id,
            isLoadingFines: true,
            fines: [linkedFine],
        });
        expect(html).toContain('data-slot="skeleton"');
        expect(html).not.toContain("Fant ingen bøter");
        expect(html).not.toContain(linkedFine.reason);
    });

    test("shows the lookup error rather than cached fine details", () => {
        const html = render({
            revealFineId: linkedFine.id,
            fines: [linkedFine],
            finesError: "Du har ikke tilgang til denne boten.",
        });
        expect(html).toContain("Du har ikke tilgang til denne boten.");
        expect(html).not.toContain(linkedFine.reason);
        expect(html).toContain("Vis nyeste bøter");
    });
});
