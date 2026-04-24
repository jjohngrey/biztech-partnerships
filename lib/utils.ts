import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with conflict resolution.
 * Used by shadcn/ui components. Safe to use anywhere.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
