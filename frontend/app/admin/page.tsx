"use client"

import { useState, useEffect, useRef } from "react"
import { 
    Users, 
    FileText, 
    CheckCircle2, 
    AlertTriangle, 
    ShieldAlert, 
    ShieldCheck, 
    Search, 
    ArrowLeft, 
    RefreshCw, 
    Bot, 
    User, 
    Sparkles, 
    Copy, 
    Check, 
    ExternalLink,
    X,
    Filter,
    Lock,
    LogOut,
    KeyRound,
    Plus,
    Link2,
    Clock,
    Send
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { API_BASE, adminFetch, getAdminToken, setAdminToken, errorMessage, UnauthorizedError } from "@/lib/api"

interface CandidateSummary {
    candidate_id: string
    name: string
    email: string
    role: string
    domain: string
    final_score: number
    technical_score: number
    cheat_warnings: number
    disqualified: boolean
    status: string
    recommendation: string
    summary: string
    resume_filename: string
    created_at: string
}

interface CandidateDetail extends CandidateSummary {
    resume_text: string
    chat_history: { role: string, content: string }[]
    evaluations: { question: string, answer: string, score: number, feedback: string }[]
    report: {
        overall_score: number
        technical_score: number
        warning_count: number
        disqualified: boolean
        strengths: string[]
        weaknesses: string[]
        summary: string
        recommendation: string
        completed_at?: string
    }
}

export default function AdminPortal() {
    const [candidates, setCandidates] = useState<CandidateSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [activeTab, setActiveTab] = useState<"report" | "resume" | "transcript">("report")
    const [hasCopiedResume, setHasCopiedResume] = useState(false)
    const [resumeViewMode, setResumeViewMode] = useState<"pdf" | "text">("pdf")

    // Admin Authentication State
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [authError, setAuthError] = useState("")

    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [adminToken, setAdminTokenState] = useState<string | null>(null)

    useEffect(() => {
        const stored = getAdminToken()
        if (stored) {
            setAdminTokenState(stored)
            setIsAuthenticated(true)
            fetchCandidates()
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoggingIn(true)
        setAuthError("")
        try {
            const res = await fetch(`${API_BASE}/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username.trim(), password })
            })
            if (!res.ok) {
                setAuthError(res.status === 401 ? "Invalid credentials." : await errorMessage(res, "Login failed. Please try again."))
                return
            }
            const data = await res.json()
            setAdminToken(data.token)
            setAdminTokenState(data.token)
            setPassword("")
            setIsAuthenticated(true)
            fetchCandidates()
        } catch (err) {
            console.error("Admin login error:", err)
            setAuthError("Could not reach the server. Please try again.")
        } finally {
            setIsLoggingIn(false)
        }
    }

    const handleLogout = () => {
        setAdminToken(null)
        setAdminTokenState(null)
        setIsAuthenticated(false)
        setSelectedCandidate(null)
        setCandidates([])
        setUsername("")
        setPassword("")
    }

    // Any admin call that comes back 401 drops the user back to the login screen
    const handleAdminError = (err: unknown, label: string) => {
        if (err instanceof UnauthorizedError) {
            handleLogout()
            setAuthError("Your session expired. Please sign in again.")
            return
        }
        console.error(label, err)
    }

    // ==========================================
    // INVITATION CREATION STATE & HANDLERS
    // ==========================================
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const [inviteTab, setInviteTab] = useState<"single" | "bulk">("single")

    // Single Invite
    const [singleName, setSingleName] = useState("")
    const [singleEmail, setSingleEmail] = useState("")
    const [singleRole, setSingleRole] = useState("Backend Engineer")
    const [singleDomain, setSingleDomain] = useState("Distributed Systems")
    const [isGeneratingSingle, setIsGeneratingSingle] = useState(false)
    const [singleGeneratedUrl, setSingleGeneratedUrl] = useState("")
    const [hasCopiedSingle, setHasCopiedSingle] = useState(false)

    // ── Bulk Invites (table-based) ──
    interface BulkRow { name: string; email: string; role: string; domain: string }
    const emptyRow = (): BulkRow => ({ name: "", email: "", role: "Software Engineer", domain: "General" })
    const [bulkRows, setBulkRows] = useState<BulkRow[]>([emptyRow(), emptyRow(), emptyRow()])
    const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)
    const [bulkResults, setBulkResults] = useState<any[]>([])
    const [copiedBulkIndex, setCopiedBulkIndex] = useState<number | null>(null)
    const [hasCopiedAllBulk, setHasCopiedAllBulk] = useState(false)
    const csvFileRef = useRef<HTMLInputElement>(null)

    const updateBulkRow = (i: number, field: keyof BulkRow, value: string) => {
        setBulkRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
    }
    const addBulkRow = () => setBulkRows(prev => [...prev, emptyRow()])
    const removeBulkRow = (i: number) => setBulkRows(prev => prev.filter((_, idx) => idx !== i))

    const handleLoadSampleBulk = () => {
        setBulkRows([
            { name: "David Miller", email: "david.miller@example.com", role: "Senior Backend Engineer", domain: "Distributed Systems" },
            { name: "Sophia Wang", email: "sophia.wang@example.com", role: "Frontend Engineer", domain: "React & Next.js" },
            { name: "Marcus Aurelius", email: "marcus.aurelius@example.com", role: "Full Stack Developer", domain: "Python & Cloud" },
        ])
    }

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const text = ev.target?.result as string
            const lines = text.split(/\r?\n/).filter(l => l.trim())
            // Skip header if it looks like one
            const start = lines[0]?.toLowerCase().includes("name") ? 1 : 0
            const rows: BulkRow[] = lines.slice(start).map(line => {
                const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ""))
                return {
                    name: parts[0] || "",
                    email: parts[1] || "",
                    role: parts[2] || "Software Engineer",
                    domain: parts[3] || "General",
                }
            }).filter(r => r.name || r.email)
            if (rows.length > 0) setBulkRows(rows)
        }
        reader.readAsText(file)
        e.target.value = ""
    }

    const handleCreateSingleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!singleName.trim() || !singleEmail.trim()) return
        setIsGeneratingSingle(true)
        try {
            const res = await adminFetch("/admin/create-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: singleName.trim(),
                    email: singleEmail.trim(),
                    role: singleRole,
                    domain: singleDomain
                })
            })
            if (res.ok) {
                const data = await res.json()
                setSingleGeneratedUrl(data.invite_url)
                fetchCandidates()
            }
        } catch (err) {
            handleAdminError(err, "Failed to generate invite:")
        } finally {
            setIsGeneratingSingle(false)
        }
    }

    const handleCreateBulkInvites = async () => {
        const validRows = bulkRows.filter(r => r.name.trim() && r.email.trim())
        if (validRows.length === 0) return
        setIsGeneratingBulk(true)
        setBulkResults([])
        try {
            const res = await adminFetch("/admin/bulk-create-invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidates: validRows })
            })
            if (res.ok) {
                const data = await res.json()
                setBulkResults(data.invites || [])
                fetchCandidates()
            }
        } catch (err) {
            handleAdminError(err, "Bulk invite creation error:")
        } finally {
            setIsGeneratingBulk(false)
        }
    }

    const handleCopyAllBulk = () => {
        if (bulkResults.length === 0) return
        const text = bulkResults.map(b => `${b.name} (${b.email}) - ${b.role}:\n${b.invite_url}\n`).join("\n")
        navigator.clipboard.writeText(text)
        setHasCopiedAllBulk(true)
        setTimeout(() => setHasCopiedAllBulk(false), 2000)
    }

    const fetchCandidates = async () => {
        setLoading(true)
        try {
            const res = await adminFetch("/admin/candidates")
            if (res.ok) {
                const data = await res.json()
                setCandidates(data)
            }
        } catch (err) {
            handleAdminError(err, "Failed to fetch admin candidates:")
        } finally {
            setLoading(false)
        }
    }

    const handleSelectCandidate = async (candidateId: string) => {
        setLoadingDetail(true)
        setActiveTab("report")
        try {
            const res = await adminFetch(`/admin/candidates/${candidateId}`)
            if (res.ok) {
                const data = await res.json()
                setSelectedCandidate(data)
            }
        } catch (err) {
            handleAdminError(err, "Failed to load candidate detail:")
        } finally {
            setLoadingDetail(false)
        }
    }

    const filteredCandidates = candidates.filter(c => {
        const matchesSearch = 
            (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.role || "").toLowerCase().includes(searchQuery.toLowerCase())

        if (statusFilter === "all") return matchesSearch
        if (statusFilter === "flagged") return matchesSearch && (c.disqualified || c.cheat_warnings >= 3)
        if (statusFilter === "hired") return matchesSearch && (c.recommendation.toLowerCase().includes("hire") && !c.recommendation.toLowerCase().includes("no"))
        return matchesSearch
    })

    const totalCount = candidates.length
    const hiredCount = candidates.filter(c => c.recommendation.toLowerCase().includes("hire") && !c.recommendation.toLowerCase().includes("no")).length
    const flaggedCount = candidates.filter(c => c.disqualified || c.cheat_warnings >= 3).length
    const avgScore = totalCount > 0 
        ? Math.round(candidates.reduce((acc, c) => acc + (c.final_score || 0), 0) / totalCount) 
        : 0

    // ==========================================
    // LOGIN SCREEN VIEW (When not authenticated)
    // ==========================================
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-blue-600/10 blur-[120px] pointer-events-none -z-10" />

                <header className="max-w-md mx-auto w-full flex items-center justify-between pb-6">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => window.location.href = "/"}
                        className="text-xs text-zinc-400 hover:text-white gap-1.5"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Return to Candidate View</span>
                    </Button>
                </header>

                <main className="max-w-md mx-auto w-full my-auto py-8">
                    <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl space-y-6">
                        <div className="text-center space-y-2">
                            <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                                <Lock className="h-5 w-5 text-blue-400" />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-white">Recruiter Admin Portal</h1>
                            <p className="text-xs text-zinc-400">
                                Sign in to inspect candidate resumes, live transcripts, and assessment results.
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs text-zinc-300 font-medium">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="admin"
                                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs text-zinc-300 font-medium">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                                />
                            </div>

                            {authError && (
                                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg text-center">
                                    {authError}
                                </p>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoggingIn || !username.trim() || !password}
                                className="w-full bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold rounded-xl h-10 mt-2"
                            >
                                {isLoggingIn ? "Signing in…" : "Enter Admin Portal"}
                            </Button>

                        </form>
                    </Card>
                </main>

                <footer className="max-w-md mx-auto w-full text-center text-[11px] text-zinc-600 pt-6">
                    Zero AI Interviewer • Protected Recruiter Dashboard
                </footer>
            </div>
        )
    }

    // ==========================================
    // AUTHENTICATED ADMIN DASHBOARD
    // ==========================================
    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => window.location.href = "/"}
                            className="rounded-xl h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-900"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs">
                            Z
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold text-white tracking-tight">Zero Recruiter Portal</h1>
                            <p className="text-[11px] text-zinc-500">Candidate Evaluation & Resume Archive</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Button
                            size="sm"
                            onClick={() => setIsInviteModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl gap-1.5 h-8 px-3.5 shadow-md shadow-blue-500/20"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Create Invitations</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchCandidates}
                            className="bg-zinc-900 border-zinc-800 text-xs text-zinc-300 hover:text-white rounded-xl gap-1.5 h-8 px-3"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl gap-1.5 h-8 px-3"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            <span>Log Out</span>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-zinc-900/50 border-zinc-800/80 p-5 rounded-2xl">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Total Candidates</span>
                        <div className="text-2xl font-bold text-white mt-1.5">{totalCount}</div>
                        <p className="text-[10px] text-zinc-500 mt-1">Sessions recorded</p>
                    </Card>
                    <Card className="bg-zinc-900/50 border-zinc-800/80 p-5 rounded-2xl">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Hiring Matches</span>
                        <div className="text-2xl font-bold text-emerald-400 mt-1.5">{hiredCount}</div>
                        <p className="text-[10px] text-zinc-500 mt-1">Strong Hire / Hire</p>
                    </Card>
                    <Card className="bg-zinc-900/50 border-zinc-800/80 p-5 rounded-2xl">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Flagged Violations</span>
                        <div className="text-2xl font-bold text-rose-400 mt-1.5">{flaggedCount}</div>
                        <p className="text-[10px] text-zinc-500 mt-1">3/3 proctor flags</p>
                    </Card>
                    <Card className="bg-zinc-900/50 border-zinc-800/80 p-5 rounded-2xl">
                        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Average Score</span>
                        <div className="text-2xl font-bold text-blue-400 mt-1.5">{avgScore}/100</div>
                        <p className="text-[10px] text-zinc-500 mt-1">Across all assessments</p>
                    </Card>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-80">
                        <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search candidate, role, or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatusFilter("all")}
                            className={`text-xs h-8 px-3 rounded-lg ${statusFilter === "all" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                        >
                            All ({totalCount})
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatusFilter("hired")}
                            className={`text-xs h-8 px-3 rounded-lg ${statusFilter === "hired" ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:text-white"}`}
                        >
                            Hires ({hiredCount})
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatusFilter("flagged")}
                            className={`text-xs h-8 px-3 rounded-lg ${statusFilter === "flagged" ? "bg-rose-500/10 text-rose-400" : "text-zinc-400 hover:text-white"}`}
                        >
                            Flagged ({flaggedCount})
                        </Button>
                    </div>
                </div>

                {/* Candidates List Table */}
                <Card className="bg-zinc-900/40 border-zinc-800/80 backdrop-blur-xl rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-950/60 border-b border-zinc-800/80 text-zinc-400 font-medium">
                                <tr>
                                    <th className="py-3.5 px-5">Candidate</th>
                                    <th className="py-3.5 px-5">Target Role</th>
                                    <th className="py-3.5 px-5">Score</th>
                                    <th className="py-3.5 px-5">Recommendation</th>
                                    <th className="py-3.5 px-5">Integrity Telemetry</th>
                                    <th className="py-3.5 px-5">Resume</th>
                                    <th className="py-3.5 px-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-850/60 text-zinc-300">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-zinc-500">
                                            Loading candidates from database...
                                        </td>
                                    </tr>
                                ) : filteredCandidates.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-zinc-500">
                                            No candidates found matching the criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCandidates.map((candidate) => {
                                        const isHire = candidate.recommendation.toLowerCase().includes("hire") && !candidate.recommendation.toLowerCase().includes("no")
                                        const isFlagged = candidate.disqualified || candidate.cheat_warnings >= 3

                                        return (
                                            <tr key={candidate.candidate_id} className="hover:bg-zinc-800/30 transition-colors">
                                                <td className="py-3.5 px-5">
                                                    <div className="font-semibold text-white">{candidate.name}</div>
                                                    <div className="text-[10px] text-zinc-500">{candidate.email || "No email provided"}</div>
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    <span className="font-medium text-zinc-200">{candidate.role}</span>
                                                    <span className="block text-[10px] text-zinc-500">{candidate.domain}</span>
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    <span className={`font-mono font-bold text-sm ${candidate.final_score >= 80 ? 'text-emerald-400' : candidate.final_score >= 60 ? 'text-blue-400' : 'text-amber-400'}`}>
                                                        {candidate.final_score}/100
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                                        isFlagged 
                                                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                            : isHire 
                                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    }`}>
                                                        {candidate.recommendation}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    <div className="flex items-center gap-1.5">
                                                        {isFlagged ? (
                                                            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                                                        ) : (
                                                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                                        )}
                                                        <span className={isFlagged ? "text-rose-400 font-medium" : "text-zinc-400"}>
                                                            {candidate.cheat_warnings} flag(s)
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                                                        <FileText className="h-3.5 w-3.5 text-blue-400" />
                                                        <span className="truncate max-w-[120px]">{candidate.resume_filename}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-5 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleSelectCandidate(candidate.candidate_id)}
                                                        className="bg-zinc-900 border-zinc-800 text-xs text-zinc-300 hover:text-white rounded-lg h-7 px-2.5"
                                                    >
                                                        Inspect
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </main>

            {/* Candidate Detail Modal / Drawer */}
            {selectedCandidate && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <Card className="bg-zinc-950 border-zinc-800 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs">
                                    {selectedCandidate.name.charAt(0) || "C"}
                                </div>
                                <div>
                                    <h2 className="font-semibold text-white text-sm">{selectedCandidate.name}</h2>
                                    <p className="text-[11px] text-zinc-400">{selectedCandidate.role} • {selectedCandidate.email || "No email"}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
                                    <button
                                        onClick={() => setActiveTab("report")}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeTab === "report" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                                    >
                                        Assessment Report
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("resume")}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeTab === "resume" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                                    >
                                        Resume PDF
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("transcript")}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeTab === "transcript" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                                    >
                                        Dialogue Stream
                                    </button>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedCandidate(null)}
                                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {activeTab === "report" && (
                                <div className="space-y-6">
                                    {/* 3-card metrics */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl text-center">
                                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Overall Score</span>
                                            <div className="text-3xl font-extrabold text-white my-1">
                                                {selectedCandidate.final_score}/100
                                            </div>
                                            <span className="text-[10px] text-zinc-500">Technical: {selectedCandidate.technical_score}%</span>
                                        </Card>

                                        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl">
                                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Recommendation</span>
                                            <div className="mt-2">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold ${
                                                    selectedCandidate.disqualified 
                                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                }`}>
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    <span>{selectedCandidate.recommendation}</span>
                                                </span>
                                            </div>
                                        </Card>

                                        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl">
                                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Proctoring Telemetry</span>
                                            <div className="mt-2 text-xs space-y-1">
                                                <div className="text-zinc-300 font-medium">
                                                    Flags Logged: {selectedCandidate.cheat_warnings}
                                                </div>
                                                <p className="text-[10px] text-zinc-500">
                                                    {selectedCandidate.disqualified ? "Violated 3/3 maximum threshold" : "Within acceptable integrity parameters"}
                                                </p>
                                            </div>
                                        </Card>
                                    </div>

                                    {/* Summary */}
                                    <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl">
                                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Bot className="h-4 w-4 text-blue-400" />
                                            <span>Executive Evaluation Summary</span>
                                        </h3>
                                        <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                                            {selectedCandidate.report?.summary || selectedCandidate.summary || "No executive summary logged."}
                                        </p>
                                    </Card>

                                    {/* Strengths & Weaknesses */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl">
                                            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                <span>Demonstrated Strengths</span>
                                            </h4>
                                            <ul className="space-y-2 text-xs text-zinc-300">
                                                {(selectedCandidate.report?.strengths || ["Participated actively in interview"]).map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </Card>

                                        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl">
                                            <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                <span>Areas for Development</span>
                                            </h4>
                                            <ul className="space-y-2 text-xs text-zinc-300">
                                                {(selectedCandidate.report?.weaknesses || ["Architecture depth could be enhanced"]).map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </Card>
                                    </div>
                                </div>
                            )}

                            {activeTab === "resume" && (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-emerald-400" />
                                            <span className="font-medium text-white">{selectedCandidate.resume_filename || "resume.pdf"}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {/* PDF / Text mode toggle */}
                                            <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
                                                <button
                                                    onClick={() => setResumeViewMode("pdf")}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                                        resumeViewMode === "pdf" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
                                                    }`}
                                                >
                                                    PDF Document
                                                </button>
                                                <button
                                                    onClick={() => setResumeViewMode("text")}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                                        resumeViewMode === "text" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
                                                    }`}
                                                >
                                                    Extracted Text
                                                </button>
                                            </div>

                                            {/* Open in new tab */}
                                            <a
                                                href={`${API_BASE}/candidates/${selectedCandidate.candidate_id}/resume-file?token=${encodeURIComponent(adminToken || "")}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg text-[11px] transition-colors"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                <span>Open Tab</span>
                                            </a>

                                            {/* Copy text if in text mode */}
                                            {resumeViewMode === "text" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(selectedCandidate.resume_text)
                                                        setHasCopiedResume(true)
                                                        setTimeout(() => setHasCopiedResume(false), 2000)
                                                    }}
                                                    className="bg-zinc-900 border-zinc-800 text-xs text-zinc-300 hover:text-white rounded-lg h-7 gap-1"
                                                >
                                                    {hasCopiedResume ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                                    <span>{hasCopiedResume ? "Copied" : "Copy"}</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {resumeViewMode === "pdf" ? (
                                        <div className="w-full h-[620px] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-inner">
                                            <iframe
                                                src={`${API_BASE}/candidates/${selectedCandidate.candidate_id}/resume-file?token=${encodeURIComponent(adminToken || "")}`}
                                                className="w-full h-full border-0"
                                                title={`Resume for ${selectedCandidate.name}`}
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-[550px] overflow-y-auto">
                                            {selectedCandidate.resume_text || "No extracted resume text available."}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "transcript" && (
                                <div className="space-y-3">
                                    <div className="text-xs text-zinc-400 mb-2">
                                        Complete verbatim transcript between Zero AI and {selectedCandidate.name}:
                                    </div>
                                    {selectedCandidate.chat_history && selectedCandidate.chat_history.length > 0 ? (
                                        selectedCandidate.chat_history.map((msg, i) => (
                                            <div
                                                key={i}
                                                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                {msg.role !== 'user' && (
                                                    <div className="h-6 w-6 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-semibold text-zinc-300 flex-shrink-0 mt-0.5">
                                                        Z
                                                    </div>
                                                )}
                                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                                    msg.role === 'user'
                                                        ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700'
                                                        : 'bg-zinc-900/90 border border-zinc-800 text-zinc-200 rounded-bl-none'
                                                }`}>
                                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                                </div>
                                                {msg.role === 'user' && (
                                                    <div className="h-6 w-6 rounded-md bg-zinc-700 flex items-center justify-center text-[10px] text-white flex-shrink-0 mt-0.5">
                                                        <User className="h-3.5 w-3.5" />
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-zinc-500 py-10 text-xs">
                                            No transcript recorded for this session.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        {/* ═══════════════════════════════════════════════════════════
             INVITE CREATION MODAL
        ═══════════════════════════════════════════════════════════ */}
        {isInviteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    onClick={() => {
                        setIsInviteModalOpen(false)
                        setSingleGeneratedUrl("")
                        setBulkResults([])
                    }}
                />

                {/* Modal card */}
                <div className="relative z-10 w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

                    {/* Modal header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                                <Link2 className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                            <h2 className="text-sm font-semibold text-white">Create Interview Invitation</h2>
                        </div>
                        <button
                            onClick={() => {
                                setIsInviteModalOpen(false)
                                setSingleGeneratedUrl("")
                                setBulkResults([])
                            }}
                            className="text-zinc-500 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex border-b border-zinc-800">
                        <button
                            onClick={() => setInviteTab("single")}
                            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                                inviteTab === "single"
                                    ? "text-white border-b-2 border-emerald-500"
                                    : "text-zinc-500 hover:text-zinc-300"
                            }`}
                        >
                            Single Invite
                        </button>
                        <button
                            onClick={() => setInviteTab("bulk")}
                            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                                inviteTab === "bulk"
                                    ? "text-white border-b-2 border-emerald-500"
                                    : "text-zinc-500 hover:text-zinc-300"
                            }`}
                        >
                            Bulk Invite
                        </button>
                    </div>

                    {/* ─── SINGLE INVITE PANEL ─── */}
                    {inviteTab === "single" && (
                        <div className="p-6">
                            {!singleGeneratedUrl ? (
                                <form onSubmit={handleCreateSingleInvite} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1.5">Full Name *</label>
                                            <input
                                                required
                                                type="text"
                                                value={singleName}
                                                onChange={e => setSingleName(e.target.value)}
                                                placeholder="Jane Smith"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1.5">Email Address *</label>
                                            <input
                                                required
                                                type="email"
                                                value={singleEmail}
                                                onChange={e => setSingleEmail(e.target.value)}
                                                placeholder="jane@company.com"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1.5">Role / Title</label>
                                            <input
                                                type="text"
                                                value={singleRole}
                                                onChange={e => setSingleRole(e.target.value)}
                                                placeholder="Senior Backend Engineer"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-400 mb-1.5">Domain / Tech Stack</label>
                                            <input
                                                type="text"
                                                value={singleDomain}
                                                onChange={e => setSingleDomain(e.target.value)}
                                                placeholder="Distributed Systems"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-3 py-2">
                                        <Clock className="h-3 w-3 text-zinc-600 flex-shrink-0" />
                                        Link expires in <strong className="text-zinc-300">1 hour</strong>. Name &amp; email are embedded in the JWT.
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isGeneratingSingle}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-10 text-sm font-medium"
                                    >
                                        {isGeneratingSingle ? (
                                            <span className="flex items-center gap-2">
                                                <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Generating…
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Send className="h-3.5 w-3.5" />
                                                Generate Invite Link
                                            </span>
                                        )}
                                    </Button>
                                </form>
                            ) : (
                                /* ── Generated link view ── */
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Invite link generated!
                                    </div>
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                                        <p className="text-xs text-zinc-500">Candidate: <span className="text-zinc-200">{singleName}</span> · <span className="text-zinc-400">{singleEmail}</span></p>
                                        <p className="text-xs text-zinc-500">Role: <span className="text-zinc-300">{singleRole}</span> · Domain: <span className="text-zinc-300">{singleDomain}</span></p>
                                    </div>
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-300 break-all">
                                        {singleGeneratedUrl}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => {
                                                navigator.clipboard.writeText(singleGeneratedUrl)
                                                setHasCopiedSingle(true)
                                                setTimeout(() => setHasCopiedSingle(false), 2000)
                                            }}
                                            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-9 text-xs"
                                        >
                                            {hasCopiedSingle ? <><Check className="h-3 w-3 mr-1 text-emerald-400" /> Copied!</> : <><Copy className="h-3 w-3 mr-1" /> Copy Link</>}
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setSingleGeneratedUrl("")
                                                setSingleName("")
                                                setSingleEmail("")
                                                setSingleRole("Backend Engineer")
                                                setSingleDomain("Distributed Systems")
                                            }}
                                            variant="outline"
                                            className="flex-1 bg-transparent border-zinc-700 text-zinc-300 hover:text-white rounded-xl h-9 text-xs"
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> New Invite
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── BULK INVITE PANEL ─── */}
                    {inviteTab === "bulk" && (
                        <div className="p-6 space-y-4">
                            {/* hidden CSV file input */}
                            <input
                                ref={csvFileRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={handleCSVUpload}
                            />

                            {/* Toolbar */}
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-zinc-400">
                                    Fill the table below — or upload a CSV file
                                    <span className="text-zinc-600 ml-1">(Name, Email, Role, Domain)</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => csvFileRef.current?.click()}
                                        className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        Upload CSV
                                    </button>
                                    <button
                                        onClick={handleLoadSampleBulk}
                                        className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                                    >
                                        Load sample
                                    </button>
                                </div>
                            </div>

                            {/* Editable table */}
                            <div className="border border-zinc-800 rounded-xl overflow-hidden">
                                {/* Table header */}
                                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_28px] gap-0 bg-zinc-900 border-b border-zinc-800">
                                    {["Name", "Email", "Role", "Domain", ""].map((h, i) => (
                                        <div key={i} className={`text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-2.5 py-2 ${i < 4 ? "border-r border-zinc-800" : ""}`}>
                                            {h}
                                        </div>
                                    ))}
                                </div>
                                {/* Table rows */}
                                <div className="max-h-52 overflow-y-auto">
                                    {bulkRows.map((row, i) => (
                                        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_28px] gap-0 border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-900/40 transition-colors">
                                            {(["name", "email", "role", "domain"] as const).map((field, fi) => (
                                                <input
                                                    key={field}
                                                    type={field === "email" ? "email" : "text"}
                                                    value={row[field]}
                                                    onChange={e => updateBulkRow(i, field, e.target.value)}
                                                    placeholder={
                                                        field === "name" ? "Jane Smith" :
                                                        field === "email" ? "jane@acme.com" :
                                                        field === "role" ? "Backend Engineer" :
                                                        "Python & Cloud"
                                                    }
                                                    className={`w-full bg-transparent px-2.5 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:bg-zinc-900/60 transition-colors ${fi < 3 ? "border-r border-zinc-800/60" : ""}`}
                                                />
                                            ))}
                                            <button
                                                onClick={() => removeBulkRow(i)}
                                                className="flex items-center justify-center text-zinc-700 hover:text-rose-400 transition-colors"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Add row */}
                            <button
                                onClick={addBulkRow}
                                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <Plus className="h-3 w-3" />
                                Add row
                            </button>

                            {/* Generate button */}
                            <Button
                                onClick={handleCreateBulkInvites}
                                disabled={isGeneratingBulk || bulkRows.filter(r => r.name.trim() && r.email.trim()).length === 0}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-10 text-sm font-medium"
                            >
                                {isGeneratingBulk ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Generating invites…
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Send className="h-3.5 w-3.5" />
                                        Generate {bulkRows.filter(r => r.name.trim() && r.email.trim()).length > 0
                                            ? `${bulkRows.filter(r => r.name.trim() && r.email.trim()).length} `
                                            : ""}Invite{bulkRows.filter(r => r.name.trim() && r.email.trim()).length !== 1 ? "s" : ""}
                                    </span>
                                )}
                            </Button>

                            {/* Results */}
                            {bulkResults.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-zinc-400">{bulkResults.length} invite{bulkResults.length > 1 ? "s" : ""} generated &amp; saved to MongoDB</span>
                                        <Button
                                            onClick={handleCopyAllBulk}
                                            size="sm"
                                            className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg h-7 text-xs gap-1"
                                        >
                                            {hasCopiedAllBulk ? <><Check className="h-3 w-3 text-emerald-400" /> Copied All</> : <><Copy className="h-3 w-3" /> Copy All</>}
                                        </Button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                        {bulkResults.map((item, i) => (
                                            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-xs font-medium text-white">{item.name}</span>
                                                        <span className="text-xs text-zinc-500 ml-2">{item.email}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(item.invite_url)
                                                            setCopiedBulkIndex(i)
                                                            setTimeout(() => setCopiedBulkIndex(null), 2000)
                                                        }}
                                                        className="text-zinc-500 hover:text-emerald-400 transition-colors flex-shrink-0 ml-2"
                                                    >
                                                        {copiedBulkIndex === i ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                                    </button>
                                                </div>
                                                <div className="font-mono text-[10px] text-zinc-500 truncate">{item.invite_url}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
        </div>
    )
}
