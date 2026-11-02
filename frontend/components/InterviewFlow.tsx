"use client"

import { useState } from "react"
import CandidateSetup from "./CandidateSetup"
import QuizRound from "./QuizRound"
import InterviewRoom from "./InterviewRoom"

interface InterviewFlowProps {
    role: string
    domain: string
    candidateId: string
    prefillName?: string
    prefillEmail?: string
}

type Phase = "setup" | "quiz" | "interview"

export default function InterviewFlow({
    role, domain, candidateId, prefillName, prefillEmail
}: InterviewFlowProps) {
    const [phase, setPhase] = useState<Phase>("setup")
    // candidateId may be updated after resume upload (new doc created)
    const [resolvedCandidateId, setResolvedCandidateId] = useState(candidateId)
    const [quizScore, setQuizScore] = useState(0)

    // Called by CandidateSetup once resume is uploaded
    const handleSetupDone = (uploadedCandidateId: string) => {
        setResolvedCandidateId(uploadedCandidateId)
        setPhase("quiz")
    }

    const handleQuizComplete = (score: number) => {
        setQuizScore(score)
        setPhase("interview")
    }

    if (phase === "setup") {
        return (
            <CandidateSetup
                name={prefillName || ""}
                email={prefillEmail || ""}
                role={role}
                domain={domain}
                candidateId={resolvedCandidateId}
                onReady={handleSetupDone}
            />
        )
    }

    if (phase === "quiz") {
        return (
            <QuizRound
                domain={domain}
                candidateId={resolvedCandidateId}
                prefillName={prefillName}
                prefillEmail={prefillEmail}
                onComplete={handleQuizComplete}
            />
        )
    }

    return (
        <InterviewRoom
            role={role}
            candidateId={resolvedCandidateId}
            quizScore={quizScore}
            isCandidate={!!prefillName}
        />
    )
}
