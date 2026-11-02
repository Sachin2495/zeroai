"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, Clock, ArrowRight, HelpCircle, Sparkles } from "lucide-react"

interface QuizQuestion {
    question: string
    options: string[]
    correct_index: number
}

interface QuizRoundProps {
    domain: string
    candidateId: string
    onComplete: (score: number) => void
    prefillName?: string
    prefillEmail?: string
}

export default function QuizRound({ domain, candidateId, onComplete, prefillName, prefillEmail }: QuizRoundProps) {
    const [questions, setQuestions] = useState<QuizQuestion[]>([])
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
    const [loading, setLoading] = useState(true)
    const [showResults, setShowResults] = useState(false)
    const [secondsElapsed, setSecondsElapsed] = useState(0)
    const [loadError, setLoadError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchQuiz()
    }, [])

    useEffect(() => {
        if (loading || showResults) return
        const interval = setInterval(() => {
            setSecondsElapsed(prev => prev + 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [loading, showResults])

    const fetchQuiz = async () => {
        try {
            setLoading(true)
            setLoadError("")
            const res = await fetch("/api/generate-quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    domain,
                    candidate_id: candidateId
                })
            })

            if (!res.ok) throw new Error("Failed to generate quiz")

            const data = await res.json()
            const qs: QuizQuestion[] = data.questions || []
            if (qs.length === 0) throw new Error("No questions returned")
            setQuestions(qs)
            setCurrentQuestion(0)
            setSelectedAnswers(new Array(qs.length).fill(-1))
        } catch (err) {
            console.error("Quiz generation error:", err)
            setLoadError("We couldn't prepare your quiz. This is usually temporary — please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleAnswer = useCallback((answerIndex: number) => {
        setSelectedAnswers(prev => {
            const next = [...prev]
            next[currentQuestion] = answerIndex
            return next
        })
    }, [currentQuestion])

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(prev => prev + 1)
        } else {
            calculateResults()
        }
    }

    const calculateResults = () => {
        let correct = 0
        questions.forEach((q, i) => {
            if (selectedAnswers[i] === q.correct_index) {
                correct++
            }
        })
        setShowResults(true)
    }

    // Keyboard navigation (A, B, C, D or 1, 2, 3, 4)
    useEffect(() => {
        if (loading || showResults || !questions.length) return

        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toUpperCase()
            if (key === "A" || key === "1") handleAnswer(0)
            else if (key === "B" || key === "2") handleAnswer(1)
            else if (key === "C" || key === "3") handleAnswer(2)
            else if (key === "D" || key === "4") handleAnswer(3)
            else if (e.key === "Enter" && selectedAnswers[currentQuestion] !== -1) {
                handleNext()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [loading, showResults, currentQuestion, selectedAnswers, questions.length, handleAnswer])

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return `${m}:${s < 10 ? '0' : ''}${s}`
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                    <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
                        <Sparkles className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-white">Synthesizing Technical Quiz</h2>
                        <p className="text-xs text-zinc-400">
                            Analyzing your resume and tailoring questions for the {domain} role...
                        </p>
                    </div>
                    <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
                    </div>
                </div>
            </div>
        )
    }

    if (loadError || questions.length === 0) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                    <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-rose-400">
                        <XCircle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-white">Quiz unavailable</h2>
                        <p className="text-xs text-zinc-400">
                            {loadError || "We couldn't prepare your quiz. Please try again."}
                        </p>
                    </div>
                    <Button
                        onClick={fetchQuiz}
                        className="h-10 px-6 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl font-medium text-xs"
                    >
                        Try again
                    </Button>
                </div>
            </div>
        )
    }

    const handleProceed = async (score: number, correctCount: number, total: number) => {
        if (isSubmitting) return
        setIsSubmitting(true)
        try {
            if (candidateId) {
                await fetch(`/api/candidate/${candidateId}/quiz-result`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        quiz_score: score,
                        total_questions: total,
                        correct_count: correctCount
                    })
                })
            }
        } catch (e) {
            console.error("Failed to record quiz score to backend:", e)
        }
        onComplete(score)
    }

    if (showResults) {
        const correctCount = selectedAnswers.filter((a, i) => a === questions[i]?.correct_index).length
        const total = questions.length || 1
        const score = Math.round((correctCount / total) * 100)

        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
                <Card className="max-w-xl w-full bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
                    <CardHeader className="text-center pb-2 pt-8">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mx-auto mb-3">
                            Round 1 Complete
                        </div>
                        <CardTitle className="text-2xl font-bold text-white tracking-tight">Technical Screening Result</CardTitle>
                        <p className="text-xs text-zinc-400 mt-1">Domain: {domain} • Time: {formatTime(secondsElapsed)}</p>
                    </CardHeader>

                    <CardContent className="space-y-6 px-8 py-6">
                        {/* Score Gauge */}
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative h-28 w-28 rounded-full border-4 border-zinc-800 flex flex-col items-center justify-center bg-zinc-950/50">
                                <span className={`text-3xl font-extrabold tracking-tight ${score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-blue-400' : 'text-amber-400'}`}>
                                    {score}%
                                </span>
                                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Score</span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-3 text-center">
                                Answered <span className="text-white font-medium">{correctCount} of {total}</span> questions correctly
                            </p>
                        </div>

                        {/* Breakdown review */}
                        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                            {questions.map((q, idx) => {
                                const isCorrect = selectedAnswers[idx] === q.correct_index
                                return (
                                    <div key={idx} className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-xl flex items-start gap-3 text-xs">
                                        {isCorrect ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-zinc-200 font-medium line-clamp-1">{idx + 1}. {q.question}</p>
                                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                                Answer: <span className={isCorrect ? "text-emerald-400" : "text-rose-400"}>{q.options[selectedAnswers[idx]] || "Skipped"}</span>
                                                {!isCorrect && (
                                                    <span className="text-zinc-400 ml-2">
                                                        (Correct: {q.options[q.correct_index]})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>

                    <CardFooter className="px-8 pb-8 pt-2">
                        <Button
                            className="w-full h-11 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl font-medium text-sm transition-all"
                            onClick={() => handleProceed(score, correctCount, total)}
                            disabled={isSubmitting}
                        >
                            <span>Proceed to AI Video Interview (Round 2)</span>
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    const currentQ = questions[currentQuestion]
    const progress = ((currentQuestion + 1) / questions.length) * 100

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
            {/* Header */}
            <header className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-white">
                        Z
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">Round 1: Technical Screening</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                                {domain}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-850">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{formatTime(secondsElapsed)}</span>
                    </div>
                    <span className="text-zinc-500 font-sans">
                        Question <strong className="text-white">{currentQuestion + 1}</strong> of {questions.length}
                    </span>
                </div>
            </header>

            {/* Subtle Progress Bar */}
            <div className="w-full bg-zinc-900 h-1">
                <div 
                    className="bg-blue-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Quiz Card Content */}
            <main className="flex-1 flex items-center justify-center p-6">
                <Card className="max-w-2xl w-full bg-zinc-900/50 border-zinc-800/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
                    <CardHeader className="pb-4 pt-6 px-8">
                        <div className="text-xs text-blue-400 font-medium tracking-wide uppercase mb-1">
                            Question {currentQuestion + 1}
                        </div>
                        <CardTitle className="text-xl font-semibold text-white leading-relaxed">
                            {currentQ?.question}
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3 px-8 pb-6">
                        {currentQ?.options.map((option, index) => {
                            const isSelected = selectedAnswers[currentQuestion] === index
                            const letter = String.fromCharCode(65 + index)
                            return (
                                <button
                                    key={index}
                                    onClick={() => handleAnswer(index)}
                                    className={`
                                        w-full p-4 text-left rounded-xl border transition-all duration-150 flex items-center justify-between text-sm
                                        ${isSelected
                                            ? "border-blue-500 bg-blue-500/10 text-white shadow-sm ring-1 ring-blue-500/40"
                                            : "border-zinc-800/90 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-950/80"
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3.5">
                                        <span className={`
                                            h-6 w-6 rounded-md flex items-center justify-center text-xs font-semibold
                                            ${isSelected 
                                                ? "bg-blue-500 text-white" 
                                                : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                                            }
                                        `}>
                                            {letter}
                                        </span>
                                        <span className="font-medium">{option}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">
                                        [{letter}]
                                    </span>
                                </button>
                            )
                        })}
                    </CardContent>

                    <CardFooter className="px-8 pb-6 pt-2 flex items-center justify-between border-t border-zinc-850/60">
                        <p className="text-xs text-zinc-500 hidden sm:block">
                            Press keys <span className="font-mono text-zinc-400">A-D</span> to select, <span className="font-mono text-zinc-400">Enter</span> to next
                        </p>
                        <Button
                            onClick={handleNext}
                            disabled={selectedAnswers[currentQuestion] === -1}
                            className="ml-auto h-10 px-6 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl font-medium text-xs transition-all"
                        >
                            {currentQuestion < questions.length - 1 ? (
                                <div className="flex items-center gap-1.5">
                                    <span>Next</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </div>
                            ) : (
                                <span>Finish Screening</span>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </div>
    )
}
