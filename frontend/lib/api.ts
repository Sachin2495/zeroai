// All backend calls go through the same-origin proxy at app/api/[...path]/route.ts
export const API_BASE = "/api"

const ADMIN_TOKEN_KEY = "zero_admin_token"

export function getAdminToken(): string | null {
    if (typeof window === "undefined") return null
    try {
        return sessionStorage.getItem(ADMIN_TOKEN_KEY)
    } catch {
        return null
    }
}

export function setAdminToken(token: string | null) {
    try {
        if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
        else sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    } catch {
        // storage unavailable (private mode); session simply won't persist
    }
}

export class UnauthorizedError extends Error {}

/** fetch() for admin endpoints: attaches the admin token and surfaces 401s. */
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    const token = getAdminToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
    if (res.status === 401) {
        setAdminToken(null)
        throw new UnauthorizedError("Session expired")
    }
    return res
}

/** Reads FastAPI's {"detail": ...} error body, falling back to a generic message. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const data = await res.json()
        if (typeof data?.detail === "string") return data.detail
    } catch {
        // non-JSON body
    }
    return fallback
}
