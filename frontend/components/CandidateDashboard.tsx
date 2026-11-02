"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
    Upload, 
    FileText, 
    CheckCircle, 
    ArrowRight, 
    Code2, 
    Server, 
    Layers, 
    BarChart3, 
    Briefcase,
    ShieldCheck,
    BrainCircuit,
    Sparkles,
    X
} from "lucide-react"

interface CandidateDashboardProps {
    onStart: (role: string, candidateId?: string, domain?: string) => void;
}

export default function CandidateDashboard({ onStart }: CandidateDashboardProps) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [role, setRole] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success">("idle")
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0])
        }
    }

    const handleClearFile = (e: React.MouseEvent) => {
        e.stopPropagation()
        setFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const handleStartInterview = async () => {
        if (!file || !role) return

        setIsUploading(true)
        setUploadStatus("uploading")

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('role', getRoleDisplayName(role))
            formData.append('domain', getRoleDisplayName(role))
            if (name.trim()) formData.append('name', name.trim())
            if (email.trim()) formData.append('email', email.trim())

            const res = await fetch('http://localhost:8000/api/upload-resume', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) {
                throw new Error('Upload failed')
            }

            const data = await res.json()
            setUploadStatus("success")
            setIsUploading(false)

            setTimeout(() => {
                onStart(getRoleDisplayName(role), data.candidate_id, getRoleDisplayName(role))
            }, 800)

        } catch (err) {
            console.error('Upload error:', err)
            alert('Failed to upload resume. Please try again.')
            setIsUploading(false)
            setUploadStatus("idle")
        }
    }

    const getRoleDisplayName = (roleValue: string): string => {
        const roleMap: { [key: string]: string } = {
            'frontend': 'Frontend Engineer',
            'backend': 'Backend Engineer',
            'fullstack': 'Full Stack Developer',
            'data-scientist': 'Data Scientist',
            'pm': 'Product Manager'
        }
        return roleMap[roleValue] || roleValue
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden font-sans">
            {/* Subtle background ambient gradients */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent blur-[120px] pointer-events-none -z-10" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-purple-600/5 blur-[100px] pointer-events-none -z-10" />

            {/* Top Navigation */}
            <header className="max-w-5xl mx-auto w-full flex items-center justify-between pb-6 border-b border-zinc-800/80">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center font-bold tracking-tight text-white shadow-sm">
                        Z
                    </div>
                    <div>
                        <span className="font-semibold text-base tracking-tight text-white">Zero</span>
                        <span className="text-xs text-zinc-400 block font-normal">Agentic Interview System</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = "/admin"}
                        className="bg-zinc-900 border-zinc-800 text-xs text-zinc-300 hover:text-white rounded-full h-7 px-3"
                    >
                        Admin Portal
                    </Button>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300">
                        <Sparkles className="h-3 w-3 text-blue-400" /> LangGraph Multi-Agent
                    </span>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-xl mx-auto w-full my-auto py-8">
                {/* Stage Steps Indicator */}
                <div className="flex items-center justify-center gap-6 mb-8 text-xs font-medium text-zinc-400">
                    <div className="flex items-center gap-2 text-white">
                        <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-semibold">1</span>
                        <span>Setup</span>
                    </div>
                    <div className="h-[1px] w-8 bg-zinc-800" />
                    <div className="flex items-center gap-2 text-zinc-500">
                        <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[11px]">2</span>
                        <span>Quiz</span>
                    </div>
                    <div className="h-[1px] w-8 bg-zinc-800" />
                    <div className="flex items-center gap-2 text-zinc-500">
                        <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-[11px]">3</span>
                        <span>AI Video</span>
                    </div>
                </div>

                {/* Setup Card */}
                <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                    <CardHeader className="space-y-1.5 pb-4">
                        <CardTitle className="text-xl font-semibold tracking-tight text-white">Candidate Assessment</CardTitle>
                        <CardDescription className="text-zinc-400 text-sm">
                            Select your target role and attach your resume. Zero will tailor questions to your actual experience.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {/* Candidate Optional Details */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="cand-name" className="text-xs text-zinc-300 font-medium">Candidate Name</Label>
                                <Input
                                    id="cand-name"
                                    placeholder="Jane Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-zinc-950/70 border-zinc-800 focus:border-zinc-700 text-sm h-10 rounded-lg placeholder:text-zinc-600 text-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cand-email" className="text-xs text-zinc-300 font-medium">Email Address</Label>
                                <Input
                                    id="cand-email"
                                    type="email"
                                    placeholder="jane@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-zinc-950/70 border-zinc-800 focus:border-zinc-700 text-sm h-10 rounded-lg placeholder:text-zinc-600 text-white"
                                />
                            </div>
                        </div>

                        {/* Role Selection */}
                        <div className="space-y-1.5">
                            <Label htmlFor="role" className="text-xs text-zinc-300 font-medium">Role Applying For <span className="text-red-400">*</span></Label>
                            <Select onValueChange={setRole} value={role}>
                                <SelectTrigger id="role" className="w-full bg-zinc-950/70 border-zinc-800 focus:border-zinc-700 text-sm h-10 rounded-lg text-white">
                                    <SelectValue placeholder="Choose engineering or product discipline..." />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                    <SelectItem value="frontend">
                                        <div className="flex items-center gap-2">
                                            <Code2 className="h-4 w-4 text-blue-400" />
                                            <span>Frontend Engineer (React, Next.js, Web APIs)</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="backend">
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4 text-emerald-400" />
                                            <span>Backend Engineer (Python, FastAPI, Databases)</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="fullstack">
                                        <div className="flex items-center gap-2">
                                            <Layers className="h-4 w-4 text-purple-400" />
                                            <span>Full Stack Developer</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="data-scientist">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-amber-400" />
                                            <span>Data Scientist & ML Engineer</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pm">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4 text-rose-400" />
                                            <span>Technical Product Manager</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Resume Upload Area */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-zinc-300 font-medium">Resume (PDF, DOCX, or TXT) <span className="text-red-400">*</span></Label>
                            
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                id="resume-upload"
                                accept=".pdf,.doc,.docx,.txt"
                                onChange={handleFileChange}
                            />

                            {!file ? (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                                        border border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-200
                                        flex flex-col items-center justify-center gap-2.5
                                        ${isDragging 
                                            ? "border-blue-500 bg-blue-500/10 scale-[1.01]" 
                                            : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-950/80"
                                        }
                                    `}
                                >
                                    <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                                        <Upload className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">
                                            Click to browse or drop your resume here
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            Supported: PDF, DOCX, TXT up to 10MB
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-zinc-200 truncate">{file.name}</p>
                                            <p className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB • Ready</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleClearFile}
                                        className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg flex-shrink-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="pt-2 pb-6 px-6">
                        <Button
                            className="w-full h-11 bg-white text-zinc-950 hover:bg-zinc-200 transition-all font-medium text-sm rounded-xl shadow-sm"
                            onClick={handleStartInterview}
                            disabled={!file || !role || isUploading}
                        >
                            {isUploading ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                                    <span>Processing Resume...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <span>Proceed to Assessment</span>
                                    <ArrowRight className="h-4 w-4" />
                                </div>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                {/* Features Pills */}
                <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-850 flex flex-col items-center gap-1">
                        <BrainCircuit className="h-4 w-4 text-zinc-400 mb-0.5" />
                        <span className="text-[11px] font-medium text-zinc-300">Multi-Agent</span>
                        <span className="text-[10px] text-zinc-500">LangGraph Engine</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-850 flex flex-col items-center gap-1">
                        <ShieldCheck className="h-4 w-4 text-zinc-400 mb-0.5" />
                        <span className="text-[11px] font-medium text-zinc-300">Live Proctoring</span>
                        <span className="text-[10px] text-zinc-500">MediaPipe Vision</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-850 flex flex-col items-center gap-1">
                        <Sparkles className="h-4 w-4 text-zinc-400 mb-0.5" />
                        <span className="text-[11px] font-medium text-zinc-300">Adaptive Tone</span>
                        <span className="text-[10px] text-zinc-500">Emotion-Aware</span>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="max-w-5xl mx-auto w-full text-center text-xs text-zinc-600 pt-6 border-t border-zinc-900">
                Zero AI Interviewer • Production Multi-Agent Assessment System
            </footer>
        </div>
    )
}
