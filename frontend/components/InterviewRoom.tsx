"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
    AlertTriangle, 
    Mic, 
    MicOff, 
    Video, 
    VideoOff, 
    Eye, 
    ShieldCheck, 
    ShieldAlert, 
    Clock, 
    Copy, 
    Check, 
    RotateCcw, 
    Sparkles, 
    Bot, 
    User,
    TrendingUp,
    CheckCircle2,
    Target
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"

export default function InterviewRoom({ role, candidateId, quizScore = 0, isCandidate = false }: { role: string, candidateId?: string, quizScore?: number, isCandidate?: boolean }) {
    // Anti-Cheat & Telemetry
    const [warningCount, setWarningCount] = useState(0)
    const [lastViolation, setLastViolation] = useState<string | null>(null)
    const [isDisqualified, setIsDisqualified] = useState(false)
    const tabSwitchAlertRef = useRef(false)
    const hasEndedRef = useRef(false)
    const hasInitializedRef = useRef(false)
    const [gazeDirection, setGazeDirection] = useState("center")
    const [isFacePresent, setIsFacePresent] = useState(true)
    const [isAlertDismissed, setIsAlertDismissed] = useState(false)
    // Refs mirror state that is read from long-lived callbacks (speech recognition, timers),
    // which would otherwise see the values from the first render.
    const warningCountRef = useRef(0)
    const lastViolationAtRef = useRef(0)
    const mountedAtRef = useRef(Date.now())
    const reportRequestedRef = useRef(false)
    const emotionRef = useRef<{ label: string, score: number } | null>(null)
    const gazeRef = useRef("center")
    const facePresentRef = useRef(true)
    const micOnRef = useRef(true)
    const aiSpeakingRef = useRef(false)
    const awaitingResponseRef = useRef(false)
    const transcriptBufferRef = useRef("")

    // Post-interview view: "thanks" (candidate completion) or "report" (detailed evaluation)
    const [postInterviewView, setPostInterviewView] = useState<"thanks" | "report">("thanks")

    const videoRef = useRef<HTMLVideoElement>(null)
    const [isCameraOn, setIsCameraOn] = useState(true)
    const [isMicOn, setIsMicOn] = useState(true)
    const [emotion, setEmotion] = useState<{ label: string, score: number } | null>(null)
    const [isAISpeaking, setIsAISpeaking] = useState(false)
    const [messages, setMessages] = useState<{ role: "ai" | "user", text: string, timestamp?: string }[]>([])
    const [closedCaptions, setClosedCaptions] = useState("")
    const chatBottomRef = useRef<HTMLDivElement>(null)

    // Speech Recognition & Interaction
    const [isRecording, setIsRecording] = useState(false)
    const recognitionRef = useRef<any>(null)
    const silenceTimeoutRef = useRef<any>(null)

    // 5-minute timer
    const [timeRemaining, setTimeRemaining] = useState(300)
    const [report, setReport] = useState<any>(null)
    const [isGeneratingReport, setIsGeneratingReport] = useState(false)
    const [hasCopiedReport, setHasCopiedReport] = useState(false)

    // Trigger violation & auto-terminate on 3rd violation
    const triggerViolation = useCallback((reason: string) => {
        if (hasEndedRef.current) return
        const now = Date.now()
        // Grace period for the camera/mic permission prompt, which blurs the window on load
        if (now - mountedAtRef.current < 8000) return
        // One tab switch fires both "blur" and "visibilitychange"; count it once
        if (now - lastViolationAtRef.current < 2000) return
        lastViolationAtRef.current = now

        const newCount = warningCountRef.current + 1
        warningCountRef.current = newCount
        setWarningCount(newCount)
        setLastViolation(reason)
        setIsAlertDismissed(false)
        tabSwitchAlertRef.current = true

        // Automatically exit if candidate switches tabs or loses focus 3 times
        if (newCount >= 3) {
            setIsDisqualified(true)
            setTimeout(() => {
                handleEndInterview(true, `Exceeded 3/3 maximum integrity violations (${reason})`, newCount)
            }, 200)
        }
    }, [])

    // Telemetry setters: refs always hold the latest value; state only changes when the
    // displayed value changes, so the per-frame face tracking doesn't re-render 60x/second.
    const updateEmotion = (next: { label: string, score: number }) => {
        const prevLabel = emotionRef.current?.label
        emotionRef.current = next
        if (prevLabel !== next.label) setEmotion(next)
    }
    const updateGaze = (next: string) => {
        if (gazeRef.current === next) return
        gazeRef.current = next
        setGazeDirection(next)
    }
    const updateFacePresent = (next: boolean) => {
        if (facePresentRef.current === next) return
        facePresentRef.current = next
        setIsFacePresent(next)
    }

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                triggerViolation("Tab Switching / Window Focus Loss")
            }
        }

        const handleBlur = () => {
            triggerViolation("Window Blur Detected")
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("blur", handleBlur)

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            window.removeEventListener("blur", handleBlur)
        }
    }, [triggerViolation])

    // Auto-scroll chat
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, closedCaptions])

    // MediaPipe Setup
    useEffect(() => {
        let faceLandmarker: FaceLandmarker;
        let animationFrameId: number;

        const setupVision = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );

                faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                });

                startPrediction();
            } catch (err) {
                console.warn("MediaPipe Vision initialization warning:", err)
            }
        }

        const startPrediction = () => {
            if (videoRef.current && faceLandmarker) {
                if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                    const nowInMs = Date.now();
                    const results = faceLandmarker.detectForVideo(videoRef.current, nowInMs);

                    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                        updateFacePresent(true);
                        const shapes = results.faceBlendshapes[0].categories;
                        const smile = shapes.find(s => s.categoryName === 'mouthSmileLeft')?.score || 0;
                        const browUp = shapes.find(s => s.categoryName === 'browInnerUp')?.score || 0;
                        const eyeSquint = shapes.find(s => s.categoryName === 'eyeSquintLeft')?.score || 0;

                        if (browUp > 0.3) updateEmotion({ label: "Nervous", score: browUp });
                        else if (smile > 0.3) updateEmotion({ label: "Happy", score: smile });
                        else if (eyeSquint > 0.4) updateEmotion({ label: "Focused", score: eyeSquint });
                        else updateEmotion({ label: "Neutral", score: Math.max(smile, browUp, eyeSquint) });

                        // Gaze tracking
                        const eyeLookOutLeft = shapes.find(s => s.categoryName === 'eyeLookOutLeft')?.score || 0;
                        const eyeLookInRight = shapes.find(s => s.categoryName === 'eyeLookInRight')?.score || 0;
                        const eyeLookOutRight = shapes.find(s => s.categoryName === 'eyeLookOutRight')?.score || 0;
                        const eyeLookInLeft = shapes.find(s => s.categoryName === 'eyeLookInLeft')?.score || 0;

                        if (eyeLookOutLeft > 0.35 || eyeLookInRight > 0.35) {
                            updateGaze("left");
                        } else if (eyeLookOutRight > 0.35 || eyeLookInLeft > 0.35) {
                            updateGaze("right");
                        } else {
                            updateGaze("center");
                        }
                    } else {
                        updateFacePresent(false);
                    }
                }
            }
            animationFrameId = requestAnimationFrame(startPrediction);
        }

        setupVision();
        startCamera();

        const initInterview = () => {
            if (hasInitializedRef.current) return;
            const voices = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
            if (voices.length > 0 || typeof window === 'undefined' || !window.speechSynthesis) {
                hasInitializedRef.current = true;
                if (window.speechSynthesis) {
                    window.speechSynthesis.onvoiceschanged = null;
                }
                setTimeout(() => {
                    const initialGreeting = `Welcome. I'm Zero, your AI technical interviewer for the ${role} position. Let's begin: tell me about a challenging technical project you recently designed or implemented.`;
                    addMessage("ai", initialGreeting);
                    speakText(initialGreeting, () => {
                        setTimeout(() => startInteraction(), 500);
                    });
                }, 1000);
            } else {
                setTimeout(initInterview, 100);
            }
        };

        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = initInterview;
            initInterview();
        } else {
            initInterview();
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (videoRef.current && videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = null;
                window.speechSynthesis.cancel();
            }
        }
    }, [role]);

    // Timer countdown
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    handleEndInterview();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera access error:", err);
        }
    }

    const SpeechRecognitionImpl = typeof window !== 'undefined'
        // @ts-ignore - vendor-prefixed in Chromium/Safari
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : undefined;

    const startInteraction = () => {
        if (hasEndedRef.current || !micOnRef.current || awaitingResponseRef.current) return;

        if (aiSpeakingRef.current) {
            window.speechSynthesis.cancel();
            aiSpeakingRef.current = false;
            setIsAISpeaking(false);
        }

        if (!SpeechRecognitionImpl) {
            console.warn("Speech API not available in this browser");
            return;
        }

        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* already stopped */ }
            recognitionRef.current = null;
        }

        const recognition = new SpeechRecognitionImpl();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsRecording(true);
        };

        recognition.onend = () => {
            setIsRecording(false);
            if (recognitionRef.current === recognition) recognitionRef.current = null;
            // Recognition stops on its own after a pause; keep listening until the answer is sent
            setTimeout(() => {
                if (!recognitionRef.current && !aiSpeakingRef.current) startInteraction();
            }, 300);
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'aborted' || event.error === 'no-speech') return;
            console.warn("Speech recognition notice:", event.error);
        };

        recognition.onresult = (event: any) => {
            const results = event.results;
            let interimTranscript = '';

            for (let i = event.resultIndex; i < results.length; i++) {
                const transcript = results[i][0].transcript;
                if (results[i].isFinal) {
                    transcriptBufferRef.current = `${transcriptBufferRef.current} ${transcript}`.trim();
                } else {
                    interimTranscript += transcript;
                }
            }

            setClosedCaptions(`${transcriptBufferRef.current} ${interimTranscript}`.trim());

            if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = null;
            }

            if (transcriptBufferRef.current && !interimTranscript) {
                // Send once the candidate has been quiet for a few seconds
                silenceTimeoutRef.current = setTimeout(() => {
                    const answer = transcriptBufferRef.current;
                    transcriptBufferRef.current = "";
                    silenceTimeoutRef.current = null;
                    if (!answer || hasEndedRef.current) return;
                    addMessage("user", answer);
                    setClosedCaptions("");
                    sendToBackend(answer);
                }, 3500);
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) {
            console.error("Recognition start error:", e);
        }
    }

    // Spoken dialogue text sanitizer - strips all markdown symbols so TTS reads clean, natural speech
    const sanitizeSpokenText = (text: string): string => {
        if (!text) return "";
        return text
            .replace(/```[\s\S]*?```/g, "") // strip code fences
            .replace(/`+([^`]+)`+/g, "$1")   // inline backticks
            .replace(/#{1,6}\s*/g, "")        // markdown headers ###
            .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1") // bold / italics
            .replace(/[*_]+/g, "")           // remaining asterisks/underscores
            .replace(/^\s*[-*•\d\.]+\s+/gm, "") // bullets
            .replace(/^\s*>\s*/gm, "")       // blockquotes
            .replace(/<[^>]*>/g, "")         // HTML tags
            .replace(/[`~|\\^{}\[\]]/g, "")  // brackets, tildes, pipes
            .replace(/\s+/g, " ")            // collapse whitespace
            .trim();
    };

    const addMessage = (role: "ai" | "user", text: string) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setMessages(prev => [...prev, { role, text: sanitizeSpokenText(text), timestamp: time }]);
    }

    const speakText = (text: string, onEndCallback?: () => void) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const cleanSpoken = sanitizeSpokenText(text);
            const utterance = new SpeechSynthesisUtterance(cleanSpoken);
            const voices = window.speechSynthesis.getVoices();
            const femaleVoice = voices.find(v =>
                v.name.includes('Female') ||
                v.name.includes('Samantha') ||
                v.name.includes('Victoria') ||
                v.name.includes('Zira') ||
                (v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman')))
            );

            if (femaleVoice) {
                utterance.voice = femaleVoice;
            }

            utterance.rate = 1.0;
            utterance.pitch = 1.05;

            aiSpeakingRef.current = true;
            utterance.onstart = () => setIsAISpeaking(true);
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                aiSpeakingRef.current = false;
                setIsAISpeaking(false);
                if (onEndCallback) onEndCallback();
            };
            utterance.onend = finish;
            utterance.onerror = finish;
            window.speechSynthesis.speak(utterance);
        } else {
            if (onEndCallback) onEndCallback();
        }
    }

    const resumeListening = () => {
        awaitingResponseRef.current = false;
        setTimeout(() => startInteraction(), 500);
    }

    const sendToBackend = async (text: string) => {
        // Stop listening while Zero thinks and speaks, so the TTS audio isn't transcribed
        awaitingResponseRef.current = true;
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* already stopped */ }
            recognitionRef.current = null;
        }
        try {
            const currentEmotion = emotionRef.current;

            const payload = {
                session_id: candidateId || "test-session",
                transcript: text,
                emotion_label: currentEmotion ? currentEmotion.label : "neutral",
                emotion_score: currentEmotion ? currentEmotion.score : 0.0,
                gaze_direction: gazeRef.current,
                face_present: facePresentRef.current,
                tab_switch_alert: tabSwitchAlertRef.current
            };

            tabSwitchAlertRef.current = false;

            const res = await fetch("/api/interact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.status === 409) {
                // Interview already finalised server-side (e.g. completed in another tab)
                handleEndInterview();
                return;
            }
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);

            const data = await res.json();
            if (hasEndedRef.current) return;
            const cleanText = sanitizeSpokenText(data.text);
            addMessage("ai", cleanText);

            if (data.next_round_trigger) {
                triggerViolation("Severe Proctor Flag: Focus threshold exceeded");
            }

            speakText(cleanText, resumeListening);

        } catch (err) {
            console.error("API interact error:", err);
            if (hasEndedRef.current) return;
            const retryText = "I'm having a brief connection issue. Could you continue explaining that thought?";
            addMessage("ai", retryText);
            speakText(retryText, resumeListening);
        }
    }

    const stopMedia = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }

        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* already stopped */ }
            recognitionRef.current = null;
        }
        micOnRef.current = false;
        aiSpeakingRef.current = false;
        transcriptBufferRef.current = "";

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }

        setIsCameraOn(false);
        setIsMicOn(false);
        setIsRecording(false);
        setIsAISpeaking(false);
        setClosedCaptions("");
    }

    const handleEndInterview = async (disqualified = false, reason?: string, explicitWarningCount?: number) => {
        // The timer, the end button and the 3rd violation can all race to end the interview
        if (reportRequestedRef.current) return;
        reportRequestedRef.current = true;
        hasEndedRef.current = true;
        stopMedia();
        setIsGeneratingReport(true);
        if (disqualified) {
            setIsDisqualified(true);
        }
        const finalWarnings = explicitWarningCount !== undefined ? explicitWarningCount : warningCountRef.current;
        try {
            const res = await fetch(`/api/report/${candidateId || "test-session"}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    warning_count: finalWarnings,
                    disqualified: disqualified,
                    disqualification_reason: reason || null,
                    quiz_score: quizScore
                })
            });
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            setReport(parsed);
        } catch (err) {
            console.error("Report generation error:", err);
            const baseline = Math.round(0.35 * (quizScore || 0));
            setReport({
                overall_score: disqualified ? Math.min(baseline, 30) : baseline,
                technical_score: baseline,
                warning_count: finalWarnings,
                disqualified: disqualified,
                strengths: ["Participated in preliminary technical screening"],
                weaknesses: disqualified ? ["Disqualified due to 3 integrity violations"] : ["Live interview incomplete or pending"],
                summary: disqualified ? "Assessment terminated due to integrity policy violations." : `Preliminary quiz score: ${quizScore}%.`,
                recommendation: disqualified ? "No Hire (Integrity Alert)" : (baseline >= 50 ? "Consider" : "No Hire")
            });
        } finally {
            setIsGeneratingReport(false);
        }
    }

    const toggleMic = () => {
        const next = !micOnRef.current
        micOnRef.current = next
        setIsMicOn(next)
        if (!next && recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* already stopped */ }
            recognitionRef.current = null
        } else if (next && !aiSpeakingRef.current) {
            startInteraction()
        }
    }

    const toggleCamera = () => {
        const next = !isCameraOn
        setIsCameraOn(next)
        const stream = videoRef.current?.srcObject as MediaStream | null
        stream?.getVideoTracks().forEach(track => { track.enabled = next })
    }

    const handleCopyReport = () => {
        if (!report) return
        navigator.clipboard.writeText(JSON.stringify(report, null, 2))
        setHasCopiedReport(true)
        setTimeout(() => setHasCopiedReport(false), 2000)
    }

    // ==========================================
    // POST-INTERVIEW VIEWS
    // ==========================================
    if (report) {
        let reportData = report;
        if (typeof report === 'string') {
            try {
                const clean = report.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                reportData = JSON.parse(clean);
            } catch (e) {
                reportData = {
                    overall_score: isDisqualified ? 35 : 75,
                    technical_score: 75.0,
                    strengths: ["Engaged and completed technical dialogue"],
                    weaknesses: isDisqualified ? ["Exceeded 3/3 integrity violations"] : ["Additional system architecture depth recommended"],
                    summary: report,
                    recommendation: isDisqualified ? "No Hire (Integrity Alert)" : "Consider"
                };
            }
        }

        const score = reportData.overall_score ?? reportData.score ?? (isDisqualified ? 35 : 70);
        const techScore = reportData.technical_score ?? 75;
        const totalViolations = reportData.warning_count ?? warningCount;
        const recommendation = reportData.recommendation || (isDisqualified ? "No Hire (Integrity Alert)" : "Consider");
        const isPositive = recommendation.toLowerCase().includes("hire") && !recommendation.toLowerCase().includes("no");

        // 1. CANDIDATE COMPLETION SCREEN (Default)
        if (postInterviewView === "thanks") {
            return (
                <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-6 md:p-12 font-sans relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[130px] pointer-events-none -z-10" />

                    <header className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-white">
                                Z
                            </div>
                            <div>
                                <h1 className="font-semibold text-base text-white">Zero AI Interviewer</h1>
                                <p className="text-xs text-zinc-400">Technical Assessment Session</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isCandidate && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPostInterviewView("report")}
                                        className="bg-zinc-900 border-zinc-800 text-xs text-zinc-300 hover:text-white rounded-lg"
                                    >
                                        Recruiter Report
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.location.href = "/admin"}
                                        className="bg-zinc-900 border-zinc-800 text-xs text-blue-400 hover:text-blue-300 rounded-lg"
                                    >
                                        Admin Portal
                                    </Button>
                                </>
                            )}
                        </div>
                    </header>

                    <main className="max-w-xl mx-auto w-full my-auto py-12">
                        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl p-8 rounded-3xl text-center space-y-6 shadow-2xl">
                            <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center bg-zinc-950 border border-zinc-800">
                                {isDisqualified || totalViolations >= 3 ? (
                                    <ShieldAlert className="h-8 w-8 text-rose-400" />
                                ) : (
                                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                                )}
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold tracking-tight text-white">
                                    {isDisqualified || totalViolations >= 3 ? "Assessment Session Terminated" : "Thank You for Attending!"}
                                </h2>
                                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                                    {isDisqualified || totalViolations >= 3
                                        ? "Your assessment session was automatically closed after detecting 3 window focus or browser tab-switch violations."
                                        : `Your technical interview assessment for the ${role} position has been successfully recorded and submitted.`
                                    }
                                </p>
                            </div>

                            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 text-left space-y-2.5 text-xs">
                                <div className="flex justify-between text-zinc-400">
                                    <span>Applied Role</span>
                                    <span className="font-medium text-white">{role}</span>
                                </div>
                                <div className="flex justify-between text-zinc-400">
                                    <span>Candidate ID</span>
                                    <span className="font-mono text-zinc-300">{candidateId || "Guest Session"}</span>
                                </div>
                                <div className="flex justify-between text-zinc-400">
                                    <span>Integrity Status</span>
                                    <span className={isDisqualified || totalViolations >= 3 ? "font-semibold text-rose-400" : "font-semibold text-emerald-400"}>
                                        {isDisqualified || totalViolations >= 3 ? `Terminated (${totalViolations}/3 Flags)` : "Verified (Normal)"}
                                    </span>
                                </div>
                                <div className="flex justify-between text-zinc-400">
                                    <span>Completed At</span>
                                    <span className="text-zinc-300 font-mono">{new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>

                            <p className="text-[11px] text-zinc-500 leading-normal">
                                Our recruitment and technical engineering team will review your audio responses, technical depth, and proctoring logs. You will receive next steps via your registered contact information.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                {isCandidate ? (
                                    /* Candidate view — no admin actions, just a reassuring note */
                                    <div className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-center">
                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                            ✅ Your interview has been submitted. You can now close this tab.
                                            <br />The recruiter will reach out via your registered email.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <Button
                                            onClick={() => window.location.reload()}
                                            className="flex-1 bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold rounded-xl h-10"
                                        >
                                            Start New Session
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setPostInterviewView("report")}
                                            className="flex-1 bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium rounded-xl h-10"
                                        >
                                            View Detailed Assessment
                                        </Button>
                                    </>
                                )}
                            </div>
                        </Card>
                    </main>

                    <footer className="max-w-2xl mx-auto w-full text-center text-xs text-zinc-600 pt-6 border-t border-zinc-900">
                        Zero AI Interviewer • LangGraph Multi-Agent Assessment System
                    </footer>
                </div>
            )
        }

        // 2. DETAILED EXECUTIVE REPORT VIEW
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-6 md:p-12 font-sans relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[130px] pointer-events-none -z-10" />

                {/* Report Header */}
                <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-white">
                            Z
                        </div>
                        <div>
                            <h1 className="font-semibold text-base text-white">Assessment Report</h1>
                            <p className="text-xs text-zinc-400">{role} Candidate Assessment</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPostInterviewView("thanks")}
                            className="bg-zinc-900 border-zinc-800 text-xs text-zinc-300 hover:text-white rounded-lg"
                        >
                            Candidate View
                        </Button>
                        {!isCandidate && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.location.href = "/admin"}
                                className="bg-zinc-900 border-zinc-800 text-xs text-blue-400 hover:text-blue-300 rounded-lg"
                            >
                                Admin Dashboard
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyReport}
                            className="bg-zinc-900 border-zinc-800 text-xs text-zinc-300 hover:text-white rounded-lg gap-1.5"
                        >
                            {hasCopiedReport ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{hasCopiedReport ? "Copied" : "Copy"}</span>
                        </Button>
                        {!isCandidate && (
                            <Button
                                size="sm"
                                onClick={() => window.location.reload()}
                                className="bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium rounded-lg gap-1.5"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>New Session</span>
                            </Button>
                        )}
                    </div>
                </header>

                {/* Report Card Body */}
                <main className="max-w-4xl mx-auto w-full my-8 space-y-6">
                    {/* Score Overview Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Overall Score */}
                        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-2">Overall Score</span>
                            <div className="relative h-24 w-24 rounded-full border-4 border-zinc-800 flex items-center justify-center bg-zinc-950/60 my-1">
                                <span className={`text-3xl font-extrabold tracking-tight ${score >= 80 ? 'text-emerald-400' : score >= 65 ? 'text-blue-400' : 'text-amber-400'}`}>
                                    {score}
                                </span>
                            </div>
                            <span className="text-xs text-zinc-500 mt-2">Scale of 0 to 100</span>
                        </Card>

                        {/* Recommendation */}
                        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl p-6 rounded-2xl flex flex-col justify-center">
                            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-2">Recommendation</span>
                            <div className="my-auto">
                                <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                    <Sparkles className="h-4 w-4" />
                                    <span>{recommendation}</span>
                                </span>
                                <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                                    Derived via multi-agent evaluation across technical depth ({techScore}%), verbal clarity, and proctoring telemetry.
                                </p>
                            </div>
                        </Card>

                        {/* Proctoring & Integrity */}
                        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl p-6 rounded-2xl flex flex-col justify-center">
                            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-2">Proctor Telemetry</span>
                            <div className="my-auto space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-300">Focus Integrity</span>
                                    <span className={`font-mono font-medium ${totalViolations >= 3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {Math.max(0, 100 - (totalViolations * 25))}%
                                    </span>
                                </div>
                                <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${totalViolations >= 3 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.max(0, 100 - (totalViolations * 25))}%` }}
                                    />
                                </div>
                                <p className="text-[11px] text-zinc-500">
                                    {totalViolations === 0 ? "Zero violations detected." : `${totalViolations} focus/tab flag(s) logged.`}
                                </p>
                            </div>
                        </Card>
                    </div>

                    {/* Executive Summary */}
                    <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl p-6 rounded-2xl">
                        <h3 className="text-sm font-semibold text-white tracking-tight mb-2 flex items-center gap-2">
                            <Bot className="h-4 w-4 text-blue-400" />
                            <span>Executive Evaluation Summary</span>
                        </h3>
                        <p className="text-sm text-zinc-300 leading-relaxed font-normal">
                            {reportData.summary || "Candidate completed the interview assessment with consistent responsiveness and skill alignment."}
                        </p>
                    </Card>

                    {/* Strengths & Weaknesses Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl p-6 rounded-2xl">
                            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Demonstrated Strengths</span>
                            </h3>
                            <ul className="space-y-2.5 text-xs text-zinc-300">
                                {(reportData.strengths || ["Engaged in technical topics", "Clear spoken communication"]).map((item: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-xl p-6 rounded-2xl">
                            <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                <span>Areas for Development</span>
                            </h3>
                            <ul className="space-y-2.5 text-xs text-zinc-300">
                                {(reportData.weaknesses || ["Deepen architectural trade-off explanations"]).map((item: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </div>
                </main>

                <footer className="max-w-4xl mx-auto w-full text-center text-xs text-zinc-600 pt-6 border-t border-zinc-900">
                    Zero AI Interviewer • LangGraph Multi-Agent Assessment System
                </footer>
            </div>
        )
    }

    // ==========================================
    // LIVE INTERVIEW ROOM VIEW
    // ==========================================
    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans select-none">
            {/* Top Warning Alert (if flagged) */}
            {warningCount > 0 && !isAlertDismissed && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md animate-in slide-in-from-top-4">
                    <Alert variant="destructive" className="bg-rose-950/90 border-rose-800 text-white shadow-2xl backdrop-blur-md rounded-xl">
                        <AlertTriangle className="h-4 w-4 text-rose-400" />
                        <AlertTitle className="text-xs font-semibold">Integrity Alert: {lastViolation}</AlertTitle>
                        <AlertDescription className="text-xs text-rose-200 mt-1">
                            Warning {warningCount}/3. Keep focus on this window to maintain full assessment integrity.
                        </AlertDescription>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-6 w-6 text-rose-300 hover:text-white"
                            onClick={() => setIsAlertDismissed(true)}
                        >
                            ×
                        </Button>
                    </Alert>
                </div>
            )}

            {/* Header */}
            <header className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-white">
                        Z
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">Round 2: AI Video Interview</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                            {role}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Proctor Badge */}
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Proctor Active</span>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-300">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        <span className={timeRemaining < 60 ? "text-rose-400 animate-pulse font-bold" : ""}>
                            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                        </span>
                    </div>

                    {/* End Interview Trigger */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEndInterview()}
                        disabled={isGeneratingReport}
                        className="text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 h-8 px-3 rounded-lg"
                    >
                        {isGeneratingReport ? "Analyzing..." : "End Session"}
                    </Button>
                </div>
            </header>

            {/* Split Workspace */}
            <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 md:p-6 max-w-7xl mx-auto w-full">
                {/* Left Pane: Zero Core & Live Transcript Feed */}
                <div className="flex flex-col gap-4 overflow-hidden h-full">
                    {/* Zero Visualizer Card */}
                    <Card className="bg-zinc-900/50 border-zinc-800/80 backdrop-blur-xl rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden flex-shrink-0">
                        {/* Audio Wave Visualizer Sphere */}
                        <div className="relative h-28 w-28 flex items-center justify-center my-2">
                            {/* Concentric ambient ring */}
                            <div className={`
                                absolute inset-0 rounded-full border transition-all duration-700
                                ${isAISpeaking 
                                    ? 'border-indigo-500/40 animate-soft-pulse scale-110' 
                                    : isRecording 
                                        ? 'border-emerald-500/40 animate-soft-pulse scale-105' 
                                        : 'border-zinc-800 scale-95'
                                }
                            `} />
                            
                            {/* Inner Sphere */}
                            <div className={`
                                h-20 w-20 rounded-full flex items-center justify-center transition-all duration-500
                                ${isAISpeaking 
                                    ? 'bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-[0_0_25px_rgba(99,102,241,0.4)]' 
                                    : isRecording 
                                        ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                                        : 'bg-zinc-850 border border-zinc-800'
                                }
                            `}>
                                {/* Waveform bars */}
                                <div className="flex items-center gap-1 h-6">
                                    {[0.1, 0.3, 0.5, 0.2, 0.4].map((delay, idx) => (
                                        <div
                                            key={idx}
                                            className={`
                                                w-1 rounded-full transition-all duration-300
                                                ${isAISpeaking || isRecording ? 'bg-white animate-wave-bar' : 'bg-zinc-600 h-1.5'}
                                            `}
                                            style={{ animationDelay: `${delay}s` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Status Label */}
                        <div className="flex flex-col items-center gap-1 text-center mt-2">
                            <span className="font-semibold text-sm text-white">Zero</span>
                            <span className={`
                                text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-all
                                ${isAISpeaking 
                                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' 
                                    : isRecording 
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                                        : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                                }
                            `}>
                                {isAISpeaking ? "Speaking..." : isRecording ? "Listening to you..." : "Ready"}
                            </span>
                        </div>
                    </Card>

                    {/* Conversation Timeline */}
                    <Card className="flex-1 min-h-0 bg-zinc-900/40 border-zinc-800/80 backdrop-blur-xl rounded-2xl flex flex-col overflow-hidden">
                        <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                            <span className="font-medium">Dialogue Stream</span>
                            <span className="text-[10px] text-zinc-500 font-mono">{messages.length} exchanges</span>
                        </div>

                        {/* Scrollable Message List */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 scroll-smooth scrollbar-thin scrollbar-thumb-zinc-700/80 scrollbar-track-zinc-900/40 hover:scrollbar-thumb-zinc-600">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'ai' && (
                                        <div className="h-6 w-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-300 flex-shrink-0 mt-0.5 text-[10px] font-semibold border border-zinc-700">
                                            Z
                                        </div>
                                    )}
                                    <div className={`
                                        max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed
                                        ${msg.role === 'user'
                                            ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700/60'
                                            : 'bg-zinc-950/85 border border-zinc-800 text-zinc-200 rounded-bl-none shadow-sm'
                                        }
                                    `}>
                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                        {msg.timestamp && (
                                            <span className="text-[9px] text-zinc-500 block text-right mt-1.5 font-mono">
                                                {msg.timestamp}
                                            </span>
                                        )}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="h-6 w-6 rounded-md bg-zinc-700 flex items-center justify-center text-white flex-shrink-0 mt-0.5 text-[10px]">
                                            <User className="h-3.5 w-3.5" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Live transcription bubble if candidate is currently speaking */}
                            {closedCaptions && (
                                <div className="flex justify-end gap-2.5">
                                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 italic rounded-br-none animate-pulse">
                                        "{closedCaptions}..."
                                    </div>
                                </div>
                            )}

                            <div ref={chatBottomRef} />
                        </div>
                    </Card>
                </div>

                {/* Right Pane: Video Stream & Biometric HUD */}
                <div className="flex flex-col gap-4 overflow-hidden h-full">
                    <div className="relative flex-1 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex items-center justify-center">
                        {/* Video Element */}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover transform scale-x-[-1] ${!isCameraOn ? 'hidden' : ''}`}
                        />

                        {/* Camera Off Placeholder */}
                        {!isCameraOn && (
                            <div className="flex flex-col items-center gap-2 text-zinc-600">
                                <VideoOff className="h-10 w-10 stroke-[1.5]" />
                                <span className="text-xs font-medium">Camera Feed Suspended</span>
                            </div>
                        )}

                        {/* Biometric & MediaPipe HUD (Top-Right) */}
                        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end pointer-events-none">
                            {/* Emotion Pill */}
                            <div className="bg-zinc-950/75 border border-zinc-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-200 flex items-center gap-2 shadow-lg">
                                <span className="text-sm">
                                    {emotion?.label === 'Happy' ? '😄' : emotion?.label === 'Focused' ? '🎯' : emotion?.label === 'Nervous' ? '😰' : '😐'}
                                </span>
                                <span>{emotion ? `${emotion.label} (${(emotion.score * 100).toFixed(0)}%)` : "Detecting..."}</span>
                            </div>

                            {/* Gaze Indicator */}
                            <div className="bg-zinc-950/75 border border-zinc-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 flex items-center gap-2 shadow-lg">
                                <Eye className={`h-3.5 w-3.5 ${gazeDirection === 'center' ? 'text-emerald-400' : 'text-amber-400'}`} />
                                <span className="capitalize">{gazeDirection === 'center' ? 'Gaze: Centered' : `Gaze: Looking ${gazeDirection}`}</span>
                            </div>

                            {/* Face Undetected Alert */}
                            {!isFacePresent && (
                                <div className="bg-rose-950/80 border border-rose-800 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-medium text-rose-200 animate-pulse shadow-lg">
                                    Face Undetected
                                </div>
                            )}
                        </div>

                        {/* Integrity Status (Top-Left) */}
                        <div className="absolute top-4 left-4 pointer-events-none">
                            <div className="bg-zinc-950/75 border border-zinc-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 flex items-center gap-1.5 shadow-lg">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Proctor Active</span>
                            </div>
                        </div>

                        {/* Floating Minimal Controls Bar (Bottom) */}
                        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-950/80 border border-zinc-800/90 backdrop-blur-xl px-4 py-2.5 rounded-full shadow-2xl">
                            {/* Mic Toggle */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleMic}
                                className={`rounded-full h-10 w-10 ${isMicOn ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'}`}
                            >
                                {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                            </Button>

                            {/* Main Talk / Speak Button */}
                            <Button
                                size="icon"
                                onClick={() => startInteraction()}
                                disabled={isAISpeaking || !isMicOn}
                                className={`
                                    rounded-full h-12 w-12 transition-all duration-200 shadow-md
                                    ${isRecording 
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30' 
                                        : isAISpeaking 
                                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                            : 'bg-white hover:bg-zinc-200 text-zinc-950'
                                    }
                                `}
                            >
                                <Mic className="h-5 w-5" />
                            </Button>

                            {/* Camera Toggle */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleCamera}
                                className={`rounded-full h-10 w-10 ${isCameraOn ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'}`}
                            >
                                {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
