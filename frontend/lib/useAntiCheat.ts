"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export function useAntiCheat() {
    const [warningCount, setWarningCount] = useState(0)
    const [lastViolation, setLastViolation] = useState<string | null>(null)

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setWarningCount(prev => prev + 1)
                setLastViolation("Tab Switching / Window Focus Loss")
                // TODO: Send violation to Backend
                console.warn("Anti-Cheat Violation: Tab Switch Detected")
            }
        }

        const handleBlur = () => {
            setWarningCount(prev => prev + 1)
            setLastViolation("Window Blur Detected")
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("blur", handleBlur)

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            window.removeEventListener("blur", handleBlur)
        }
    }, [])

    return { warningCount, lastViolation }
}
