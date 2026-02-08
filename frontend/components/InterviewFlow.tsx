"use client"

import { useState } from "react"
import QuizRound from "./QuizRound"
import InterviewRoom from "./InterviewRoom"

interface InterviewFlowProps {
    role: string
    domain: string
    resumeText: string
}

export default function InterviewFlow({ role, domain, resumeText }: InterviewFlowProps) {
    const [currentRound, setCurrentRound] = useState<"quiz" | "interview">("quiz")
    const [quizScore, setQuizScore] = useState(0)

    const handleQuizComplete = (score: number) => {
        setQuizScore(score)
        setCurrentRound("interview")
    }

    if (currentRound === "quiz") {
        return (
            <QuizRound
                domain={domain}
                resumeText={resumeText}
                onComplete={handleQuizComplete}
            />
        )
    }

    return <InterviewRoom role={role} />
}
