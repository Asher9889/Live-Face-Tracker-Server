export function convertIdToEmpId(value: string): string {
    if (!value) return 'N/A';
    return `EMP-${value.slice(-4)}`;
}

type FormatTimeOptions = {
    showSeconds?: boolean;
    locale?: string;
};

export function formatTime(timestamp: string | number | Date, options: FormatTimeOptions = {}): string {
    const { showSeconds = false, locale = "en-US" } = options;

    return new Date(timestamp).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: showSeconds ? "2-digit" : undefined,
    });
}