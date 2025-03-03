import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isAfterDateOfYear(month: number, day: number): boolean {
  const today = new Date();
  const date = new Date(today.getFullYear(), month, day);
  return today > date;
}

export function isBeforeDateOfYear(month: number, day: number): boolean {
  const today = new Date();
  const date = new Date(today.getFullYear(), month, day);
  return today < date;
}
