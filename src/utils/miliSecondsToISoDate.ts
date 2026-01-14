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