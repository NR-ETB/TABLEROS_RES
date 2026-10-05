const formatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
export const integer = (value: number) => formatter.format(value);
export const pct = (value: number) =>
  value.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + "%";
