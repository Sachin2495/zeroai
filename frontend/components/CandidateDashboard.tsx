"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, FileText, CheckCircle, ArrowRight } from "lucide-react"

interface CandidateDashboardProps {
    onStart: (role: string) => void;
}

export default function CandidateDashboard({ onStart }: CandidateDashboardProps) {
    const [role, setRole] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success">("idle")

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleStartInterview = async () => {
        if (!file || !role) return

        setIsUploading(true)
        setUploadStatus("uploading")

        try {
            // Create FormData for file upload
            const formData = new FormData()
            formData.append('file', file)
            formData.append('role', getRoleDisplayName(role))
            formData.append('domain', getRoleDisplayName(role)) // Use role as domain

            // Upload to backend
            const res = await fetch('http://localhost:8000/api/upload-resume', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) {
                throw new Error('Upload failed')
            }

            const data = await res.json()
            console.log('Resume uploaded:', data)

            setUploadStatus("success")
            setIsUploading(false)

            // Pass role to parent
            setTimeout(() => {
                onStart(getRoleDisplayName(role))
            }, 1000)

        } catch (err) {
            console.error('Upload error:', err)
            alert('Failed to upload resume. Please try again.')
            setIsUploading(false)
            setUploadStatus("idle")
        }
    }

    // Helper to get display name from role value
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
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4">
                        <img
                            src="/logo.png"
                            alt="Zero - AI Interview System"
                            className="h-32 w-32 object-contain"
                        />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-primary">Zero</h1>
                    <p className="text-muted-foreground">The AI-Powered Candidate Assessment System</p>
                </div>

                <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl">
                    <CardHeader>
                        <CardTitle>Start Your Assessment</CardTitle>
                        <CardDescription>
                            Please upload your resume and select the role you are applying for.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Role Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="role">Role Applying For</Label>
                            <Select onValueChange={setRole} value={role}>
                                <SelectTrigger id="role" className="w-full">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="frontend">Frontend Engineer</SelectItem>
                                    <SelectItem value="backend">Backend Engineer</SelectItem>
                                    <SelectItem value="fullstack">Full Stack Developer</SelectItem>
                                    <SelectItem value="data-scientist">Data Scientist</SelectItem>
                                    <SelectItem value="pm">Product Manager</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                            <Label>Resume (PDF/Docx)</Label>
                            <div
                                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  hover:border-primary/50 hover:bg-muted/50
                  ${file ? "border-primary/50 bg-muted/20" : "border-muted-foreground/25"}
                `}
                            >
                                <Input
                                    type="file"
                                    className="hidden"
                                    id="resume-upload"
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                />
                                <Label htmlFor="resume-upload" className="cursor-pointer">
                                    {file ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="h-8 w-8 text-primary" />
                                            <span className="text-sm font-medium">{file.name}</span>
                                            <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                            <span className="text-sm font-medium text-muted-foreground">Click to upload</span>
                                            <span className="text-xs text-muted-foreground">or drag and drop</span>
                                        </div>
                                    )}
                                </Label>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={handleStartInterview}
                            disabled={!file || !role || isUploading}
                        >
                            {isUploading ? "Processing..." : (
                                <>
                                    Begin Interview <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                {uploadStatus === "success" && (
                    <div className="flex items-center justify-center gap-2 text-green-500 animate-in fade-in slide-in-from-bottom-2">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">Ready! Redirecting to Interview Room...</span>
                    </div>
                )}
            </div>
        </div>
    )
}
