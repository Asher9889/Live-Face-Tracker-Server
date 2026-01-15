import { DateTime, Zone } from "luxon";

export default function miliSecondsToISoDate(ts: number) {
    if(!ts) throw new Error("Please provide valid timestamps");
    const date = DateTime.fromMillis(ts, { zone: "Asia/Kolkata" }).toFormat("yyyy-MM-dd");
    return date;
}

export function todayDate(){
    const date = DateTime.now().toFormat("yyyy-MM-dd");
    return date;
}

// utils/officeTimeToMs.ts
export function officeTimeToMs(value: string, name: string): number {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error(
      `Invalid office time format for ${name}. Expected HH:mm`
    );
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return (hours * 60 + minutes) * 60 * 1000;
}

