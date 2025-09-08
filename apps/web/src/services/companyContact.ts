import {apiClient} from "@/lib/api-client";
import type {CompaniesEmail} from '@/types/CompaniesEmail';

export async function postCompanyContact(data: CompaniesEmail): Promise<{ success: boolean; message: string }> {
    try {
        const response = await apiClient.post<{ detail?: string }>('/companyContacts', {CompaniesEmail: data});
        return {
            success: true,
            message: response.data.detail || 'Contact form submitted successfully.',
        };
    } catch (error) {
        const message = error instanceof Error? error.message : 'Failed to send contact form';
        return {
            success: false,
            message: message,
        }
    }
}