import z from "zod";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;
const DEFAULT_OFFSET = 0;

/**
 * Schema for validating pagination parameters 
 * 
 * Usage:
 * ```ts
 * route().get(
 *  "/items",
 *  validator("query", PagninationSchema.extend({ // extend can be used to add more query params
 *     search: z.string().optional(),
 *  })),
 *  async (c) => {}
 * );
 * 
 * ```
 */
export const PaginationSchema = z.object({
    pageSize: z.coerce
        .number()
        .min(MIN_LIMIT)
        .max(MAX_LIMIT)
        .default(DEFAULT_LIMIT)
        .describe("Number of items to return"),
    page: z.coerce
        .number()
        .min(0)
        .default(DEFAULT_OFFSET)
        .describe("Number of items to skip"),
});

/**
 * This is the standard response schema for when using a paginated API endpoint
 * 
 * The totalCount is the totla amount of items in that resource
 * 
 * The pages is the total amount of pages available based on the pageSize requested
 * 
 * THe nextPage is the next page that should be fetched, or null if there are noe more pages
 * 
 * Usage:
 * ```ts
 * const ResponseSchema = PaginationResponseSchema.extend({ // extend adds the any extra properties/lists
 *  events: z.array(EventSchema),
 * })
 * ```
 */
export const PagniationResponseSchema = z.object({
    totalCount: z.number().describe("Total number of items available"),
    pages: z.number().describe("Total number of pages available"),
    nextPage: z
        .number()
        .nullable()
        .describe("The next page number that can be fetched"),
});

/**
 * Helper funtion to calculate the page offset to use in database calls
 * @param page the page number to fetch
 * @param pageSize the page size used
 * @returns the page offset to fetch in the database
 */
export const getPageOffset = (page: number, pageSize: number) =>
    page * pageSize;

/**
 * Calculate the total page count based on a 0-based page index
 * @param totalCount the total number of items available
 * @param pageSize the size of each page
 * @returns the total number of pages available
 */
export const getTotalPages = (totalCount: number, pageSize: number) =>
    pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0;
