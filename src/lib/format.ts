import { format } from "date-fns";
import { id } from "date-fns/locale";

export function formatNumber(value: string | number): string {
  if (value === undefined || value === null || value === "") return "";
  const num = typeof value === "string" ? value.replace(/[^0-9]/g, "") : value.toString();
  if (!num) return "";
  return new Intl.NumberFormat("id-ID").format(Number(num));
}

export function parseNumber(formattedValue: string): number {
  if (!formattedValue) return 0;
  return Number(formattedValue.replace(/[^0-9]/g, "")) || 0;
}

export function formatRupiah(amount: number | string | null | undefined): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  const safeAmount = !value || isNaN(value) ? 0 : value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

export function formatDate(dateString: string, formatStr: string = "dd/MM/yyyy"): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    // Convert to Indonesia timezone (GMT+7)
    const indonesiaOffset = 7 * 60; // 7 hours in minutes
    const localOffset = date.getTimezoneOffset();
    const indonesiaTime = new Date(date.getTime() + (indonesiaOffset + localOffset) * 60000);
    return format(indonesiaTime, formatStr, { locale: id });
  } catch (error) {
    return dateString;
  }
}

export function normalizeCustomerCode(code: string | null | undefined): string {
  if (!code) return "";
  // Convert old C format to CTM format (C00009 -> CTM00009)
  return code.replace(/^C0*(\d+)$/, (_, num) => "CTM" + num.padStart(5, "0"));
}
