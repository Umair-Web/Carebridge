/** Display paisa as PKR (1 PKR = 100 paisa per SRS). */
export function formatPkr(paisa) {
  const n = Number(paisa) || 0;
  const pkr = n / 100;
  return `PKR ${pkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}
