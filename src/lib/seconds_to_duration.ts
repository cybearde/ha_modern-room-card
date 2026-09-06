export const secondsToDuration = (d: number): string | null => {
    const weeks = Math.floor(d / 604800);
    let remaining = d % 604800;
    const days = Math.floor(remaining / 86400);
    remaining %= 86400;
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.round(remaining % 60);

    const parts: string[] = [];
    if (weeks) parts.push(`${weeks} weeks`);
    if (days) parts.push(`${days} days`);
    if (hours) parts.push(`${hours} hours`);
    if (minutes) parts.push(`${minutes} minutes`);
    if (seconds) parts.push(`${seconds} seconds`);

    return parts.length > 0 ? parts.join(' ') : null;
};