"use client"

import { useState, useRef } from "react"
import {
    User, Mail, Briefcase, Code2, FileText,
    Upload, CheckCircle2, ArrowRight, Loader2, X, Zap
} from "lucide-react"

interface CandidateSetupProps {
    name: string
    email: string
    role: string
    domain: string
    candidateId: string
    onReady: (candidateId: string) => void
}

export default function CandidateSetup({
    name, email, role, domain, candidateId, onReady
}: CandidateSetupProps) {
    const [resumeFile, setResumeFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadDone, setUploadDone] = useState(false)
    const [error, setError] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = (file: File) => {
        if (!file.name.match(/\.(pdf|txt|docx)$/i)) {
            setError("Please upload a PDF, DOCX, or TXT file.")
            return
        }
        if (file.size > 4 * 1024 * 1024) {
            setError("File must be under 4 MB.")
            return
        }
        setError("")
        setResumeFile(file)
        setUploadDone(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }

    const handleUploadAndStart = async () => {
        if (!resumeFile) {
            setError("Please attach your resume before starting.")
            return
        }
        setUploading(true)
        setError("")
        try {
            const formData = new FormData()
            formData.append("file", resumeFile)
            formData.append("name", name)
            formData.append("email", email)
            formData.append("role", role)
            formData.append("domain", domain)
            formData.append("candidate_id", candidateId)

            const res = await fetch("/api/upload-resume", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.detail || "Upload failed")
            }

            const data = await res.json()
            setUploadDone(true)
            setTimeout(() => onReady(data.candidate_id || candidateId), 600)
        } catch (err: any) {
            setError(err.message || "Upload failed. Please try again.")
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
            <div className="w-full max-w-lg space-y-6">

                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-xs text-emerald-400">
                        <Zap className="h-3 w-3" />
                        Zero AI Interviewer
                    </div>
                    <h1 className="text-2xl font-bold text-white">
                        Welcome, {name.split(" ")[0]} 👋
                    </h1>
                    <p className="text-sm text-zinc-400">
                        You&apos;ve been invited to a structured AI interview. Review your details below and upload your resume to begin.
                    </p>
                </div>

                {/* Candidate details card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Your Interview Details</p>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
                            <User className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Name</p>
                                <p className="text-sm font-medium text-white truncate">{name}</p>
                            </div>
                        </div>

                        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
                            <Mail className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Email</p>
                                <p className="text-sm font-medium text-white truncate">{email}</p>
                            </div>
                        </div>

                        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
                            <Briefcase className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Role</p>
                                <p className="text-sm font-medium text-white truncate">{role}</p>
                            </div>
                        </div>

                        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl px-4 py-3 flex items-start gap-3">
                            <Code2 className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Domain</p>
                                <p className="text-sm font-medium text-white truncate">{domain}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resume Upload */}
                <div className="space-y-3">
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Resume Upload <span className="text-rose-400">*</span></p>

                    {/* Drop zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                            isDragging
                                ? "border-emerald-500 bg-emerald-500/5"
                                : resumeFile
                                ? "border-emerald-600/60 bg-emerald-500/5"
                                : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/40"
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.txt,.docx"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleFile(f)
                            }}
                        />

                        {resumeFile ? (
                            <div className="flex items-center justify-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-medium text-white truncate max-w-[240px]">{resumeFile.name}</p>
                                    <p className="text-xs text-zinc-500">{(resumeFile.size / 1024).toFixed(0)} KB</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setResumeFile(null) }}
                                    className="ml-2 text-zinc-600 hover:text-rose-400 transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                    <Upload className="h-5 w-5 text-zinc-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-300">
                                        <span className="text-emerald-400 font-medium">Click to upload</span> or drag &amp; drop
                                    </p>
                                    <p className="text-xs text-zinc-600 mt-1">PDF, DOCX, TXT — max 4 MB</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="text-xs text-rose-400 flex items-center gap-1.5">
                            <X className="h-3 w-3" /> {error}
                        </p>
                    )}
                </div>

                {/* Interview info pills */}
                <div className="flex flex-wrap gap-2">
                    {[
                        "📝 10-question technical quiz",
                        "🎙️ AI voice interview",
                        "⏱️ ~30–45 minutes total",
                        "🔒 Monitored session",
                    ].map((item) => (
                        <span
                            key={item}
                            className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1"
                        >
                            {item}
                        </span>
                    ))}
                </div>

                {/* CTA Button */}
                <button
                    onClick={handleUploadAndStart}
                    disabled={!resumeFile || uploading || uploadDone}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                        !resumeFile
                            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                            : uploadDone
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    }`}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading resume…
                        </>
                    ) : uploadDone ? (
                        <>
                            <CheckCircle2 className="h-4 w-4" />
                            Ready! Starting interview…
                        </>
                    ) : (
                        <>
                            Begin Interview
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </button>

                <p className="text-center text-xs text-zinc-600">
                    By continuing you agree that this session is monitored. Tab switches are logged and 3 violations auto-terminate the interview.
                </p>
            </div>
        </div>
    )
}
