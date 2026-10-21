// The Comentario API calls the moderator makes, signed in as a user with the
// Moderator role on the blog's domain: sign in, and approve or reject a
// comment. Sessions are kept per domain and renewed when Comentario refuses one.

export interface ComentarioOptions {
    baseUrl: string;
    email: string;
    password: string;
    fetch?: typeof fetch;
}

// The signed-in user as Comentario describes them on a domain
export interface Principal {
    email?: string;
    isModerator?: boolean;
    isOwner?: boolean;
    isSuperuser?: boolean;
}

export const comentarioClient = ({ baseUrl, email, password, fetch: fetchImpl = fetch }: ComentarioOptions) => {
    const sessions = new Map<string, string>();

    const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetchImpl(`${baseUrl}/api${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });

    // Signing in on a domain also makes the account one of its users
    const signIn = async (domainId: string): Promise<{ session: string; principal: Principal }> => {
        const res = await post('/embed/auth/login', { email, password, domainId });
        if (!res.ok) throw new Error(`Comentario sign-in failed: HTTP ${res.status}`);
        const { sessionToken, principal } = await res.json() as { sessionToken?: string; principal?: Principal };
        if (!sessionToken) throw new Error('Comentario sign-in returned no session token');
        sessions.set(domainId, sessionToken);
        return { session: sessionToken, principal: principal ?? {} };
    };

    // The ID of the domain registered for a host, from the page info the
    // widget loads (this registers the path as a page if it isn't one yet).
    // Comentario serves it only to the domain's own origin.
    const domainIdFor = async (host: string, path = '/'): Promise<string> => {
        const res = await post('/embed/comments', { host, path }, { Origin: `https://${host}` });
        if (!res.ok) throw new Error(`Comentario has no domain ${host}: HTTP ${res.status}`);
        const { pageInfo } = await res.json() as { pageInfo?: { domainId?: string } };
        if (!pageInfo?.domainId) throw new Error(`Comentario returned no domain ID for ${host}`);
        return pageInfo.domainId;
    };

    const moderate = async (domainId: string, commentId: string, approve: boolean): Promise<void> => {
        for (const renewed of [false, true]) {
            const session = (!renewed && sessions.get(domainId)) || (await signIn(domainId)).session;
            const res = await post(`/embed/comments/${encodeURIComponent(commentId)}/moderate`, { approve }, { 'X-User-Session': session });
            if (res.ok) return;
            if (renewed || (res.status !== 401 && res.status !== 403)) {
                throw new Error(`Comentario refused to ${approve ? 'approve' : 'reject'} comment ${commentId}: HTTP ${res.status}`);
            }
            sessions.delete(domainId);
        }
    };

    return { moderate, signIn, domainIdFor };
};
