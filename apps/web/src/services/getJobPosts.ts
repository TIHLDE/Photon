import {apiClient} from '@/lib/api-client'
import type {JobPost} from "@/types/JobPost";


export async function getJobPosts(): Promise<JobPost[]> {
    const response = await apiClient.get<JobPost[]>('/jobposts');
    return response.data;
}