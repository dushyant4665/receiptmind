import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null, currency: string = "USD"): string {
	if (amount === null || amount === undefined) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency,
	}).format(amount);
}

export function formatDate(dateString: string | null): string {
	if (!dateString) return "—";
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return "—";
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
