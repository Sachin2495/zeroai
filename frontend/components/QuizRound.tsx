"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, Clock } from "lucide-react"

interface QuizQuestion {
    question: string
    options: string[]
    correct_index: number
}

interface QuizRoundProps {
    domain: string
    resumeText: string
    onComplete: (score: number) => void
}

export default function QuizRound({ domain, resumeText, onComplete }: QuizRoundProps) {
    const [questions, setQuestions] = useState<QuizQuestion[]>([])
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
    const [loading, setLoading] = useState(true)
    const [showResults, setShowResults] = useState(false)

    useEffect(() => {
        fetchQuiz()
    }, [])

    const fetchQuiz = async () => {
        try {
            setLoading(true)
            const res = await fetch("http://localhost:8000/api/generate-quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    domain,
                    resume_text: resumeText
                })
            })

            if (!res.ok) throw new Error("Failed to generate quiz")

            const data = await res.json()
            setQuestions(data.questions)
            setSelectedAnswers(new Array(data.questions.length).fill(-1))
        } catch (err) {
            console.error("Quiz generation error:", err)
            alert("Failed to generate quiz. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleAnswer = (answerIndex: number) => {
        const newAnswers = [...selectedAnswers]
        newAnswers[currentQuestion] = answerIndex
        setSelectedAnswers(newAnswers)
    }

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1)
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

        // Pass score to parent after 3 seconds
        setTimeout(() => {
            onComplete((correct / questions.length) * 100)
        }, 3000)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
                    <p className="text-xl">Generating your personalized quiz...</p>
                </div>
            </div>
        )
    }

    if (showResults) {
        const score = Math.round((selectedAnswers.filter((a, i) => a === questions[i].correct_index).length / questions.length) * 100)

        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
                <Card className="max-w-2xl w-full bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-3xl text-center">Quiz Complete!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="text-center">
                            <div className="text-6xl font-bold text-blue-500 mb-4">{score}%</div>
                            <p className="text-zinc-400">
                                You answered {selectedAnswers.filter((a, i) => a === questions[i].correct_index).length} out of {questions.length} questions correctly
                            </p>
                        </div>

                        <div className="space-y-3">
                            {questions.map((q, i) => (
                                <div key={i} className="p-4 bg-zinc-800/50 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        {selectedAnswers[i] === q.correct_index ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium mb-2">{q.question}</p>
                                            <p className="text-sm text-zinc-400">
                                                Your answer: {q.options[selectedAnswers[i]] || "Not answered"}
                                                {selectedAnswers[i] !== q.correct_index && (
                                                    <span className="text-green-400 ml-2">
                                                        (Correct: {q.options[q.correct_index]})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="text-center text-zinc-400">Moving to AI Interview in 3 seconds...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const currentQ = questions[currentQuestion]
    const progress = ((currentQuestion + 1) / questions.length) * 100

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            {/* Header */}
            <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
                <div className="flex items-center gap-4">
                    <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                    <span className="font-semibold text-lg">Round 1/2 - Technical Quiz</span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm text-zinc-400">
                        Question {currentQuestion + 1} of {questions.length}
                    </span>
                </div>
            </header>

            {/* Progress */}
            <div className="px-6 py-4">
                <Progress value={progress} className="h-2" />
            </div>

            {/* Quiz Content */}
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="max-w-3xl w-full bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-2xl">{currentQ.question}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {currentQ.options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleAnswer(index)}
                                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${selectedAnswers[currentQuestion] === index
                                        ? "border-blue-500 bg-blue-500/20"
                                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                                    }`}
                            >
                                <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
                                {option}
                            </button>
                        ))}

                        <Button
                            onClick={handleNext}
                            disabled={selectedAnswers[currentQuestion] === -1}
                            className="w-full mt-6"
                            size="lg"
                        >
                            {currentQuestion < questions.length - 1 ? "Next Question" : "Submit Quiz"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
