import {ApiResponse} from "@/types/Misc";

const UPSTREAM = process.env.TIHLDE_API_URL;

export const apiClient = {
    async get<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`${UPSTREAM}${endpoint}`, {
                method: "GET",
                headers: {'Content-Type': 'application/json', ...options.headers},
                signal: controller.signal,
                ...options,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorMessage = await response.text().catch(() => 'Unknown error');
                throw new Error(errorMessage || `GET request failed: ${response.statusText}`);
            }

            const data = await response.json();
            return { data, success: true }

        } catch (error) {
            clearTimeout(timeoutId);
            throw error instanceof Error ? error : new Error('An unknown error occurred.');
        }
    },

    async post<T>(endpoint: string, body: unknown, options: RequestInit = {}): Promise<ApiResponse<T>> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`${UPSTREAM}${endpoint}`, {
                method: "POST",
                headers: {'Content-Type': 'application/json', ...options.headers},
                body: JSON.stringify(body),
                signal: controller.signal,
                ...options,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorMessage = await response.text().catch(() => 'Unknown error');
                throw new Error(errorMessage || `POST request failed: ${response.statusText}`);
            }

            const data = await response.json();
            return { data, success: true }

        } catch (error) {
            clearTimeout(timeoutId);
            throw error instanceof Error ? error : new Error('An unknown error occurred.');
        }
    },
}
