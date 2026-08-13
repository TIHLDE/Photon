import { describe, expect, it } from "vitest";
import { getNextPage, getTotalPages } from "~/middleware/pagination";

/**
 * Page numbers are 0-based, so the last page is `totalPages - 1`. Hand-written
 * as `page + 1 > totalPages` this handed out one page past the end, and every
 * "load more" button stayed visible until the client fetched an empty list.
 */
describe("getNextPage", () => {
    it("stops on the last page when it is partially filled", () => {
        const totalPages = getTotalPages(258, 100); // 3 pages: 0, 1, 2
        expect(getNextPage(0, totalPages)).toBe(1);
        expect(getNextPage(1, totalPages)).toBe(2);
        expect(getNextPage(2, totalPages)).toBeNull();
    });

    it("stops on the last page when the count divides evenly", () => {
        const totalPages = getTotalPages(200, 100); // 2 pages: 0, 1
        expect(getNextPage(0, totalPages)).toBe(1);
        expect(getNextPage(1, totalPages)).toBeNull();
    });

    it("has no next page for a single page or an empty result", () => {
        expect(getNextPage(0, getTotalPages(40, 100))).toBeNull();
        expect(getNextPage(0, getTotalPages(0, 100))).toBeNull();
    });
});
