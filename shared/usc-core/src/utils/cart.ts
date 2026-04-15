import type { CartLine } from "../types/domain";

export function validateSingleSupplierCart(lines: CartLine[]): { ok: true; supplierCompanyId: number } | { ok: false; reason: string } {
  const supplierIds = Array.from(
    new Set(
      lines
        .map((line) => line.product.supplierCompanyId)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  );

  if (supplierIds.length === 0) {
    return { ok: false, reason: "missing_supplier_company_id" };
  }
  if (supplierIds.length > 1) {
    return { ok: false, reason: "multiple_suppliers" };
  }

  return { ok: true, supplierCompanyId: supplierIds[0] };
}
