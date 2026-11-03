import { describe, expect, it } from "vitest";
import { trimSignature } from "~/lib/contract/pdf";

describe("trimming a contract signature", () => {
    it("does not decode what is not an allowed image, even first after boot", async () => {
        const svg = Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><rect x="9" y="9" width="9" height="9"/></svg>',
        );

        const trimmed = await trimSignature(new Uint8Array(svg));

        expect(Buffer.from(trimmed)).toEqual(svg);
    });

    it("still trims a real PNG", async () => {
        const { default: sharp } = await import("sharp");
        const png = await sharp({
            create: {
                width: 200,
                height: 100,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        })
            .composite([
                {
                    input: await sharp({
                        create: {
                            width: 50,
                            height: 20,
                            channels: 4,
                            background: { r: 0, g: 0, b: 0, alpha: 1 },
                        },
                    })
                        .png()
                        .toBuffer(),
                    left: 60,
                    top: 30,
                },
            ])
            .png()
            .toBuffer();

        const trimmed = await trimSignature(new Uint8Array(png));
        const { width, height } = await sharp(Buffer.from(trimmed)).metadata();

        expect({ width, height }).toEqual({ width: 50, height: 20 });
    });
});
