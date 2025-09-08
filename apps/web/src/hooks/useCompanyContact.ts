import {postCompanyContact} from '@/services/companyContact';
import type {CompaniesEmail} from '@/types/CompaniesEmail';

export function useCompanyContact() {
    const sendContact = async (data: CompaniesEmail) => {
        return await postCompanyContact(data);
    };

    return { sendContact };
}