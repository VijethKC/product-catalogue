const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

interface PriceProps {
  value: number;
}

export function Price({ value }: PriceProps) {
  return <span className="text-lg font-semibold text-slate-900">{currency.format(value)}</span>;
}
