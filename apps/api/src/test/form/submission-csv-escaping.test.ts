import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

function parseCsv(csv: string): string[][] {
    const rows: string[][] = [[]];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        if (quoted) {
            if (char === '"' && csv[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (char === '"') {
                quoted = false;
            } else {
                cell += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === ",") {
            rows.at(-1)?.push(cell);
            cell = "";
        } else if (char === "\n") {
            rows.at(-1)?.push(cell);
            cell = "";
            rows.push([]);
        } else {
            cell += char;
        }
    }
    rows.at(-1)?.push(cell);
    return rows;
}

describe("form submission CSV export", () => {
    integrationTest(
        "answers cannot break out of their cell or run as formulas",
        async ({ ctx }) => {
            const manager = await ctx.utils.createTestUser();
            const respondent = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(manager, ["root"]);

            const [form] = await ctx.db
                .insert(schema.form)
                .values({ title: "Påmelding" })
                .returning();
            if (!form) throw new Error("form not created");

            const answers = [
                ['=HYPERLINK("https://example.test","x")', "formula"],
                ["+1+cmd|' /C calc'!A0", "plus"],
                ["-2+3+cmd|' /C calc'!A0", "minus"],
                ["@SUM(A1:A9)", "at"],
                ["\t=1+1", "tab"],
                ["\r=1+1", "carriage return"],
                ['", "=1+1', "quote"],
                ["  =1+1", "leading space"],
                ["+47 912 34 567", "phone number"],
                ["-12,50", "negative amount"],
                ["-", "no answer"],
                ["helt vanlig svar", "plain"],
            ] as const;

            const fields = await ctx.db
                .insert(schema.formField)
                .values(
                    answers.map(([, title], order) => ({
                        formId: form.id,
                        title,
                        type: "text_answer" as const,
                        order,
                    })),
                )
                .returning();
            const [submission] = await ctx.db
                .insert(schema.formSubmission)
                .values({ formId: form.id, userId: respondent.id })
                .returning();
            if (!submission) throw new Error("submission not created");

            await ctx.db.insert(schema.formAnswer).values(
                answers.map(([answerText, title]) => ({
                    submissionId: submission.id,
                    fieldId:
                        fields.find((field) => field.title === title)?.id ?? "",
                    answerText,
                })),
            );

            const client = await ctx.utils.clientForUser(manager);
            const response = await client.api.forms[
                ":formId"
            ].submissions.download.$get({ param: { formId: form.id } });
            expect(response.status).toBe(200);

            const [headers, row] = parseCsv(await response.text());
            const cell = (title: string) =>
                row?.[headers?.indexOf(title) ?? -1];

            expect(headers?.length).toBe(row?.length);

            expect(cell("formula")).toBe(
                `'=HYPERLINK("https://example.test","x")`,
            );
            expect(cell("plus")).toBe("'+1+cmd|' /C calc'!A0");
            expect(cell("minus")).toBe("'-2+3+cmd|' /C calc'!A0");
            expect(cell("at")).toBe("'@SUM(A1:A9)");
            expect(cell("tab")).toBe("'\t=1+1");
            expect(cell("carriage return")).toBe("'\r=1+1");
            expect(cell("quote")).toBe('", "=1+1');
            expect(cell("leading space")).toBe("'  =1+1");

            expect(cell("phone number")).toBe("+47 912 34 567");
            expect(cell("negative amount")).toBe("-12,50");
            expect(cell("no answer")).toBe("-");
            expect(cell("plain")).toBe("helt vanlig svar");
        },
        60_000,
    );

    integrationTest(
        "a question title cannot run as a formula either",
        async ({ ctx }) => {
            const manager = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(manager, ["root"]);

            const [form] = await ctx.db
                .insert(schema.form)
                .values({ title: "Skjema" })
                .returning();
            if (!form) throw new Error("form not created");

            await ctx.db.insert(schema.formField).values({
                formId: form.id,
                title: '=cmd|"/C calc"!A0',
                type: "text_answer",
                order: 0,
            });

            const client = await ctx.utils.clientForUser(manager);
            const response = await client.api.forms[
                ":formId"
            ].submissions.download.$get({ param: { formId: form.id } });

            const [headers] = parseCsv(await response.text());
            expect(headers?.at(-1)).toBe(`'=cmd|"/C calc"!A0`);
        },
        60_000,
    );
});
