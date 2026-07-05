export function formatINR(amount: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
