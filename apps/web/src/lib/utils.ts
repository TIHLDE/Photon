import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import {JobPostType} from "@/types/Enums";
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get jobpost type as text
 * @param jobpostType JobPost type
 */
export const getJobpostType = (jobpostType: JobPostType) => {
    switch (jobpostType) {
        case JobPostType.PART_TIME:
            return 'Deltid';
        case JobPostType.FULL_TIME:
            return 'Fulltid';
        case JobPostType.SUMMER_JOB:
            return 'Sommerjobb';
        case JobPostType.OTHER:
            return 'Annet';
        default:
            return 'Ukjent jobbtype';
    }
};