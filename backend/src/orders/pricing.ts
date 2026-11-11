export interface PricedLine {
  unitPricePaise: number;
  quantity: number;
}

export interface Totals {
  subtotalPaise: number;
  taxPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
}

/** Server-side price calculation. Client-supplied prices are never trusted. All values in integer paise. */
export function computeTotals(lines: PricedLine[], taxPercent: number, deliveryFeePaise: number): Totals {
  const subtotalPaise = lines.reduce((s, l) => s + l.unitPricePaise * l.quantity, 0);
  const taxPaise = Math.round((subtotalPaise * taxPercent) / 100);
  return { subtotalPaise, taxPaise, deliveryFeePaise, totalPaise: subtotalPaise + taxPaise + deliveryFeePaise };
}

export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}
