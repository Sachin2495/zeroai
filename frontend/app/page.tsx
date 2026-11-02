"use client"

import { useState, useEffect } from "react"
import InterviewFlow from "@/components/InterviewFlow"
import { Loader2, ShieldX, Zap, Users, FileText, BarChart3, ArrowRight, CheckCircle2, Star, Shield, Clock } from "lucide-react"

// ─── JWT-GATED ENTRY ────────────────────────────────────────────────────────
// If URL contains ?token=..., we validate it and start the interview.
// Otherwise, we show the product landing page.
// ────────────────────────────────────────────────────────────────────────────

interface JwtPayload {
  name: string
  email: string
  role: string
  domain: string
  candidate_id: string
}

export default function Home() {
  const [mode, setMode] = useState<"loading" | "landing" | "verifying" | "interview" | "denied">("loading")
  const [jwtData, setJwtData] = useState<JwtPayload | null>(null)
  const [denyReason, setDenyReason] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")

    if (!token) {
      setMode("landing")
      return
    }

    // Token present – verify it
    setMode("verifying")
    fetch("/api/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid && data.is_completed) {
          setDenyReason("This interview has already been completed. Thank you — the recruiter will be in touch.")
          setMode("denied")
        } else if (data.valid) {
          setJwtData({
            name: data.name,
            email: data.email,
            role: data.role,
            domain: data.domain,
            candidate_id: data.candidate_id,
          })
          setMode("interview")
        } else {
          setDenyReason(data.error || "Invalid or expired invitation link.")
          setMode("denied")
        }
      })
      .catch(() => {
        setDenyReason("Could not connect to the interview server. Please try again later.")
        setMode("denied")
      })
  }, [])

  // ── Verifying spinner ──
  if (mode === "loading" || mode === "verifying") {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-zinc-400">
          <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          </div>
          <p className="text-sm">{mode === "verifying" ? "Validating your invitation…" : "Loading…"}</p>
        </div>
      </main>
    )
  }

  // ── Access Denied ──
  if (mode === "denied") {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">{denyReason}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-left space-y-2">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">What to do next</p>
            <ul className="text-sm text-zinc-300 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5">•</span>
                Check that you&apos;re using the exact link sent by the recruiter.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5">•</span>
                Invitation links expire after <strong className="text-white">1 hour</strong> — request a new one if needed.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5">•</span>
                Contact your recruiter if the issue persists.
              </li>
            </ul>
          </div>
        </div>
      </main>
    )
  }

  // ── Interview (JWT valid) ──
  if (mode === "interview" && jwtData) {
    return (
      <main>
        <InterviewFlow
          role={jwtData.role}
          domain={jwtData.domain}
          candidateId={jwtData.candidate_id}
          prefillName={jwtData.name}
          prefillEmail={jwtData.email}
        />
      </main>
    )
  }

  // ── Product Landing Page ──
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* ── Nav ── */}
      <nav className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="font-semibold text-white tracking-tight">Zero</span>
            <span className="text-xs text-zinc-600 ml-1">AI Interviewer</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Admin Portal
            </a>
            <a
              href="/admin"
              className="text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-xs text-emerald-400 mb-8">
          <Star className="h-3 w-3" />
          AI-powered technical interviews at scale
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6 leading-tight">
          Interview smarter,<br />
          <span className="text-emerald-400">hire faster</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Zero conducts structured, voice-driven AI interviews. Recruiters create invite links — candidates
          complete a quiz and a live AI interview — Zero generates detailed assessment reports automatically.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/admin"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Open Admin Portal <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium px-6 py-3 rounded-xl transition-colors"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-zinc-900 py-12">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { value: "10×", label: "Faster than phone screens" },
            { value: "100%", label: "Consistent evaluation" },
            { value: "< 1 min", label: "Setup per candidate" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-emerald-400 mb-1">{s.value}</p>
              <p className="text-sm text-zinc-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
        <p className="text-zinc-400 text-center mb-14 max-w-xl mx-auto">
          Three steps from candidate invite to hire decision.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Users className="h-5 w-5 text-emerald-400" />,
              step: "01",
              title: "Create an invite",
              desc: "Paste the candidate's name, email, and role. Zero generates a secure, 1-hour JWT link instantly. Bulk-create for entire cohorts.",
            },
            {
              icon: <FileText className="h-5 w-5 text-emerald-400" />,
              step: "02",
              title: "Candidate interviews",
              desc: "The candidate clicks the link, uploads their resume, completes a domain quiz, then has a live AI voice interview — no scheduling needed.",
            },
            {
              icon: <BarChart3 className="h-5 w-5 text-emerald-400" />,
              step: "03",
              title: "Review the report",
              desc: "Zero auto-generates a recruiter report with technical score, strengths, weaknesses, and a hire / no-hire recommendation.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                  {item.icon}
                </div>
                <span className="text-xs text-zinc-700 font-mono font-bold">{item.step}</span>
              </div>
              <h3 className="font-semibold text-white">{item.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-zinc-900/50 border-y border-zinc-900 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Everything recruiters need</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Shield className="h-4 w-4" />, title: "Anti-cheat protection", desc: "3 tab-switches = auto-disqualified. All violations logged." },
              { icon: <Clock className="h-4 w-4" />, title: "1-hour secure tokens", desc: "JWT invitations expire automatically. No link reuse." },
              { icon: <Users className="h-4 w-4" />, title: "Bulk invite creation", desc: "Invite entire cohorts via CSV. One click, all links generated." },
              { icon: <Zap className="h-4 w-4" />, title: "Voice-driven AI", desc: "Zero speaks and listens. No typing required from candidates." },
              { icon: <BarChart3 className="h-4 w-4" />, title: "Structured reports", desc: "Scores, strengths, weaknesses, and hire recommendation per candidate." },
              { icon: <CheckCircle2 className="h-4 w-4" />, title: "Full transcript", desc: "Every question and answer is stored and searchable in the admin portal." },
            ].map((f) => (
              <div key={f.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  {f.icon}
                  <span className="font-medium text-white text-sm">{f.title}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="text-4xl font-bold mb-4">Ready to transform your hiring?</h2>
        <p className="text-zinc-400 mb-8">
          Open the admin portal, create your first invite, and run a structured AI interview in minutes.
        </p>
        <a
          href="/admin"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8 py-3.5 rounded-xl transition-colors text-sm"
        >
          Open Admin Portal <ArrowRight className="h-4 w-4" />
        </a>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-900 py-8 text-center text-xs text-zinc-600">
        <p>© 2026 Zero AI Interviewer · Built with Next.js, FastAPI &amp; Groq</p>
      </footer>
    </main>
  )
}
