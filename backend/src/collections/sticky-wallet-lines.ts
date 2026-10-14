/** Lines like `@ Ahmed Ali 800` or `@ JB-CUS-000012 - 100` */
export type StickyWalletLine = {
  name: string;
  amount: number;
};

const LINE =
  /^\s*@(.+?)\s*(?:[-–:]\s*)?(\d+(?:\.\d{1,2})?)\s*$/u;

export function parseStickyWalletLines(text: string): StickyWalletLine[] {
  const out: StickyWalletLine[] = [];
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line.startsWith('@')) continue;
    const m = LINE.exec(line);
    if (!m) continue;
    const name = m[1].trim();
    const amount = Number(m[2]);
    if (!name || !Number.isFinite(amount) || amount <= 0) continue;
    out.push({ name, amount });
  }
  return out;
}
