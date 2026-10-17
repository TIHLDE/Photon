import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { Text } from "./text";

describe("Text", () => {
    test("renders only the classes it is given, on the requested tag", () => {
        expect(
            renderToStaticMarkup(
                <Text size="sm" tone="muted">
                    Hei
                </Text>,
            ),
        ).toBe('<p class="text-sm text-muted-foreground">Hei</p>');

        expect(
            renderToStaticMarkup(
                <Text
                    render={<span />}
                    size="xs"
                    tone="destructive"
                    weight="medium"
                    className="mt-1 truncate"
                    title="t"
                >
                    Hei
                </Text>,
            ),
        ).toBe(
            '<span title="t" class="text-xs text-destructive font-medium mt-1 truncate">Hei</span>',
        );
    });
});
