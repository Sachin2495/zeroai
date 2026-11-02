import { NextRequest } from "next/server"

// Server-side proxy: the browser only ever talks to this app (same origin, no CORS), and this
// handler forwards /api/* to the backend. BACKEND_URL is read at request time, so the backend
// Function URL can be set as a Lambda env var without rebuilding the image.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const HOP_BY_HOP = new Set([
    "host",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "proxy-authorization",
    "proxy-authenticate",
    "content-length",
    "accept-encoding",
])

function backendBase(): string {
    return (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
    const { path } = await ctx.params
    const target = `${backendBase()}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`

    const headers = new Headers()
    req.headers.forEach((value, key) => {
        const k = key.toLowerCase()
        if (!HOP_BY_HOP.has(k) && !k.startsWith("x-amz") && !k.startsWith("x-forwarded")) {
            headers.set(key, value)
        }
    })

    const hasBody = req.method !== "GET" && req.method !== "HEAD"
    let upstream: Response
    try {
        upstream = await fetch(target, {
            method: req.method,
            headers,
            body: hasBody ? await req.arrayBuffer() : undefined,
            redirect: "manual",
            cache: "no-store",
        })
    } catch (err) {
        console.error(`[api-proxy] ${req.method} ${target} failed:`, err)
        return Response.json({ detail: "Backend unavailable" }, { status: 502 })
    }

    // fetch() already decoded the body, so drop encoding/length headers from the upstream response.
    // Also drop the backend Function URL's x-amzn-* headers: Lambda rejects a response that sets
    // its reserved headers, which surfaces as a bare 502 "Internal Server Error".
    const resHeaders = new Headers()
    upstream.headers.forEach((value, key) => {
        const k = key.toLowerCase()
        if (!HOP_BY_HOP.has(k) && k !== "content-encoding" && k !== "date" && !k.startsWith("x-amz")) {
            resHeaders.set(key, value)
        }
    })

    return new Response(upstream.body, { status: upstream.status, headers: resHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
