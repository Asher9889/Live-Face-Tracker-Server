import ms, { StringValue } from "ms";

export default function parseDuration(value: StringValue, name: string): number {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const parsed = ms(value);
  if (typeof parsed !== "number") {
    throw new Error(`Invalid duration for ${name}: "${value}"`);
  }

  return parsed;
}