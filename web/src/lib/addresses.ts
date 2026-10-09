import { getAddress, isAddress, type Address } from "viem";

export function parseAddressList(text: string) {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const valid = new Set<Address>();
  const invalid: string[] = [];
  for (const t of tokens) {
    if (isAddress(t)) valid.add(getAddress(t));
    else invalid.push(t);
  }
  return { valid: [...valid], invalid };
}
