// Phone notifications through ntfy (https://ntfy.sh). Published as JSON to the
// server's root, since header-based publishing can't carry non-ASCII titles.
// Without NOTIFY_URL this does nothing.

export interface Notification {
    title: string;
    message: string;
    // ntfy priorities: 1 (min) … 5 (urgent)
    priority: 1 | 2 | 3 | 4 | 5;
    click?: string;
}

export const notifier = (topicUrl: string | undefined, token: string | undefined, fetchImpl: typeof fetch = fetch) => {
    if (!topicUrl) return async (_: Notification) => {};
    const url = new URL(topicUrl);
    const topic = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!topic || topic.includes('/')) throw new Error(`NOTIFY_URL must be an ntfy topic URL, like https://ntfy.sh/<topic>: ${topicUrl}`);
    return async ({ title, message, priority, click }: Notification) => {
        const res = await fetchImpl(url.origin, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...token ? { Authorization: `Bearer ${token}` } : {} },
            body: JSON.stringify({ topic, title, message, priority, ...click ? { click } : {} }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`ntfy refused the notification: HTTP ${res.status}`);
    };
};
