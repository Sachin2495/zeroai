"use client"

import { useState, useRef, useEffect } from "react"
// import { useAntiCheat } from "@/lib/useAntiCheat" <-- Removing this
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Mic, MicOff, Video, VideoOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"

export default function InterviewRoom({ role }: { role: string }) {
    // --- Anti-Cheat Logic ---
    const [warningCount, setWarningCount] = useState(0)
    const [lastViolation, setLastViolation] = useState<string | null>(null)

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setWarningCount(prev => prev + 1)
                setLastViolation("Tab Switching / Window Focus Loss")
                console.warn("Anti-Cheat Violation: Tab Switch Detected")
            }
        }

        const handleBlur = () => {
            setWarningCount(prev => prev + 1)
            setLastViolation("Window Blur Detected")
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        // window.addEventListener("blur", handleBlur) // Commented out for development convenience

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            // window.removeEventListener("blur", handleBlur)
        }
    }, [])

    const videoRef = useRef<HTMLVideoElement>(null)
    const [isCameraOn, setIsCameraOn] = useState(true)
    const [isMicOn, setIsMicOn] = useState(true)
    const [emotion, setEmotion] = useState<{ label: string, score: number } | null>(null)
    const [currentRound, setCurrentRound] = useState(2) // Changed to 2 for AI Interview round
    const [isAISpeaking, setIsAISpeaking] = useState(false)
    const [messages, setMessages] = useState<{ role: "ai" | "user", text: string }[]>([])
    const [closedCaptions, setClosedCaptions] = useState("") // For live CC display


    // Speech Recognition & Interaction
    const [isRecording, setIsRecording] = useState(false)
    const recognitionRef = useRef<any>(null)
    const silenceTimeoutRef = useRef<any>(null) // For speech delay

    // 5-minute timer
    const [timeRemaining, setTimeRemaining] = useState(300) // 5 minutes in seconds
    const [timerActive, setTimerActive] = useState(false)

    // MediaPipe Setup
    useEffect(() => {
        let faceLandmarker: FaceLandmarker;
        let animationFrameId: number;

        const setupVision = async () => {
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
        }

        const startPrediction = () => {
            if (videoRef.current && faceLandmarker) {
                // Prevent crash: check if video is loaded and has dimensions
                if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                    const nowInMs = Date.now();
                    const results = faceLandmarker.detectForVideo(videoRef.current, nowInMs);

                    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                        const shapes = results.faceBlendshapes[0].categories;
                        // Improved emotion mapping with lower thresholds
                        const smile = shapes.find(s => s.categoryName === 'mouthSmileLeft')?.score || 0;
                        const browUp = shapes.find(s => s.categoryName === 'browInnerUp')?.score || 0;
                        const eyeSquint = shapes.find(s => s.categoryName === 'eyeSquintLeft')?.score || 0;

                        if (browUp > 0.3) setEmotion({ label: "Nervous", score: browUp });
                        else if (smile > 0.3) setEmotion({ label: "Happy", score: smile });
                        else if (eyeSquint > 0.4) setEmotion({ label: "Focused", score: eyeSquint });
                        else setEmotion({ label: "Neutral", score: Math.max(smile, browUp, eyeSquint) });
                    }
                }
            }
            animationFrameId = requestAnimationFrame(startPrediction);
        }

        setupVision();
        startCamera();

        // Wait for voices to load, then start interview
        const initInterview = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                setTimeout(() => {
                    const initialGreeting = `Good day! I'm Zero, your AI interviewer. Let's begin with a simple question - tell me about your experience with ${role.toLowerCase()} work.`;
                    addMessage("ai", initialGreeting);
                    speakText(initialGreeting, () => {
                        setTimeout(() => startInteraction(), 500);
                    });
                }, 1500);
            } else {
                // Voices not loaded yet, wait
                setTimeout(initInterview, 100);
            }
        };

        // Wait for voices to be available
        if (window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = initInterview;
            initInterview(); // Try immediately too
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (videoRef.current && videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        }
    }, []);

    // Timer countdown - starts automatically
    useEffect(() => {
        setTimerActive(true); // Auto-start timer

        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    handleEndInterview(); // Auto-end when time's up
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
            console.error("Error accessing webcam:", err);
        }
    }

    const startInteraction = () => {
        console.log("🎤 startInteraction() called");

        // Stop any ongoing AI speech when user wants to speak
        if (isAISpeaking) {
            console.log("⏸️ Interrupting AI speech...");
            window.speechSynthesis.cancel();
            setIsAISpeaking(false);
        }

        if (!('webkitSpeechRecognition' in window)) {
            console.error("❌ Browser does not support webkitSpeechRecognition");
            alert("Browser does not support Speech API. Please use Chrome.");
            return;
        }

        // @ts-ignore
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log("🟢 Speech recognition started");
            setIsRecording(true);
        };

        recognition.onend = () => {
            console.log("🔴 Speech recognition ended");
            setIsRecording(false);
        };

        recognition.onerror = (event: any) => {
            // Silently handle 'aborted' and 'no-speech' errors (common and expected)
            if (event.error === 'aborted' || event.error === 'no-speech') {
                return; // Don't log, this is normal behavior
            }

            // Handle network errors gracefully
            if (event.error === 'network') {
                console.warn("Speech recognition network error. This usually means no internet connection for Google's speech service.");
                return;
            }

            // Handle permission errors
            if (event.error === 'not-allowed') {
                alert("Microphone access denied. Please allow permission in your browser settings.");
                return;
            }

            // Log other errors for debugging
            console.error("Speech Recognition Error:", event.error);
        };

        recognition.onresult = async (event: any) => {
            const results = event.results;
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = 0; i < results.length; i++) {
                const transcript = results[i][0].transcript;
                if (results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update CC with interim or final
            setClosedCaptions(finalTranscript || interimTranscript);

            // If final, wait 4 seconds for more speech before sending
            if (finalTranscript) {
                console.log("📝 Final transcript:", finalTranscript);

                // Clear any existing timeout
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                }

                // Wait 4 seconds of silence before sending
                silenceTimeoutRef.current = setTimeout(async () => {
                    console.log("✅ Silence detected, sending to backend...");
                    addMessage("user", finalTranscript);
                    setClosedCaptions(""); // Clear CC
                    await sendToBackend(finalTranscript);
                }, 4000);
            }
        };

        try {
            console.log("▶️ Attempting to start recognition...");
            recognition.start();
            recognitionRef.current = recognition;
            console.log("✅ Recognition started successfully");
        } catch (e) {
            console.error("❌ Failed to start recognition:", e);
        }
    }

    const addMessage = (role: "ai" | "user", text: string) => {
        setMessages(prev => [...prev, { role, text }]);
    }

    // Helper function for TTS
    const speakText = (text: string, onEndCallback?: () => void) => {
        if ('speechSynthesis' in window) {
            console.log("🔊 Starting TTS...");

            // CRITICAL: Cancel any ongoing speech to prevent double voices
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);

            // Configure female voice
            const voices = window.speechSynthesis.getVoices();
            const femaleVoice = voices.find(voice =>
                voice.name.includes('Female') ||
                voice.name.includes('Samantha') ||
                voice.name.includes('Victoria') ||
                voice.name.includes('Zira') ||
                voice.name.includes('Microsoft Zira') ||
                (voice.lang.startsWith('en') && (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('woman')))
            );

            if (femaleVoice) {
                utterance.voice = femaleVoice;
                console.log("🎭 Using voice:", femaleVoice.name);
            }

            utterance.rate = 1.0;
            utterance.pitch = 1.1;
            utterance.volume = 1.0;

            utterance.onstart = () => {
                console.log("🗣️ AI speaking started");
                setIsAISpeaking(true);
            };
            utterance.onend = () => {
                console.log("🗣️ AI speaking ended");
                setIsAISpeaking(false);
                if (onEndCallback) onEndCallback();
            };
            window.speechSynthesis.speak(utterance);
        } else {
            console.warn("⚠️ speechSynthesis not available");
            if (onEndCallback) onEndCallback();
        }
    }

    const sendToBackend = async (text: string) => {
        console.log("📡 Sending to backend:", text);
        try {
            const emotionLabel = emotion ? emotion.label : "neutral";
            const emotionScore = emotion ? emotion.score : 0.0;
            console.log("😊 Emotion:", emotionLabel, "(" + emotionScore + ")");

            const res = await fetch("http://localhost:8000/api/interact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: "test-session",
                    transcript: text,
                    emotion_label: emotionLabel,
                    emotion_score: emotionScore
                })
            });

            if (!res.ok) {
                console.error(`API Error: ${res.status} ${res.statusText}`);
                throw new Error(`Server responded with ${res.status}`);
            }

            const data = await res.json();
            console.log("🤖 AI Response:", data.text);
            addMessage("ai", data.text);

            // Use speakText helper for consistent female voice
            speakText(data.text, () => {
                // Auto-restart listening after AI finishes
                console.log("⏳ Waiting 500ms then restarting mic...");
                setTimeout(() => startInteraction(), 500);
            });

        } catch (err) {
            console.error("API Error", err);
            addMessage("ai", "I'm having trouble connecting to my brain. Please try again.");
        }
    }

    // Report State
    const [report, setReport] = useState<any>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const stopMedia = () => {
        // Stop video/audio stream
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }

        // Stop speech recognition
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        // CRITICAL: Stop any ongoing speech synthesis
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        // Clear silence timeout
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }

        // Reset states
        setIsCameraOn(false);
        setIsMicOn(false);
        setIsRecording(false);
        setIsAISpeaking(false);
        setClosedCaptions("");
    }

    const handleEndInterview = async () => {
        stopMedia(); // Revoke access immediately
        setIsGeneratingReport(true);
        try {
            const res = await fetch("http://localhost:8000/api/report/test-session", {
                method: "POST"
            });
            const data = await res.json();
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            setReport(parsed);
        } catch (err) {
            console.error("Report Error", err);
        } finally {
            setIsGeneratingReport(false);
        }
    }

    // Report Screen - Don't render interview UI when report is ready
    if (report) {
        // Parse report if it's JSON
        let reportData;
        try {
            // Clean and parse JSON response
            let cleanReport = report.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            reportData = JSON.parse(cleanReport);
        } catch (e) {
            console.error("Failed to parse report:", e);
            reportData = {
                overall_score: 0,
                strengths: ["Unable to parse report"],
                weaknesses: [],
                summary: report,
                recommendation: "Please review manually"
            };
        }

        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
                <Card className="max-w-3xl w-full bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="text-center border-b border-zinc-800">
                        <CardTitle className="text-3xl mb-2">Interview Report</CardTitle>
                        <CardDescription className="text-zinc-400">
                            Candidate: {role} Role Application
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 p-8">
                        {/* Score Circle */}
                        <div className="flex justify-center">
                            <div className="relative h-32 w-32 flex items-center justify-center rounded-full border-4 border-blue-500 text-4xl font-bold">
                                {reportData.overall_score || reportData.score || 0}
                            </div>
                        </div>

                        {/* Strengths & Weaknesses */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-zinc-800/50 rounded-lg">
                                <h3 className="font-semibold text-green-400 mb-2">Strengths</h3>
                                <ul className="list-disc pl-4 text-sm text-zinc-300">
                                    {(reportData.strengths || []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                            <div className="p-4 bg-zinc-800/50 rounded-lg">
                                <h3 className="font-semibold text-red-400 mb-2">Weaknesses</h3>
                                <ul className="list-disc pl-4 text-sm text-zinc-300">
                                    {(reportData.weaknesses || []).map((w: string, i: number) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="p-4 bg-zinc-800/50 rounded-lg">
                            <h3 className="font-semibold text-blue-400 mb-2">Summary</h3>
                            <p className="text-sm text-zinc-300">{reportData.summary || "No summary available"}</p>
                        </div>

                        {/* Recommendation */}
                        <div className="text-center">
                            <span className={`text-xl font-bold px-4 py-2 rounded-full ${reportData.recommendation && reportData.recommendation.includes('No') ? 'bg-red-900 text-red-100' : 'bg-green-900 text-green-100'}`}>
                                Recommendation: {reportData.recommendation || "Pending"}
                            </span>
                        </div>

                        <Button onClick={() => window.location.reload()} className="w-full" size="lg">
                            Start New Interview
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            {warningCount > 0 && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg animate-in slide-in-from-top-4">
                    <Alert variant="destructive" className="bg-red-900/90 border-red-500 text-white shadow-2xl backdrop-blur-md">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Warning: Suspicious Activity Detected</AlertTitle>
                        <AlertDescription>
                            {lastViolation}. Attempts: {warningCount}/3. Further violations may terminate the interview.
                        </AlertDescription>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-6 w-6 text-red-200 hover:text-white hover:bg-red-800/50"
                            onClick={() => setWarningCount(0)}
                        >
                            <span className="sr-only">Dismiss</span>
                            ×
                        </Button>
                    </Alert>
                </div>
            )}
            {/* Header */}
            <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="Zero" className="h-10 w-10 object-contain" />
                    <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-semibold text-lg">Interview in Session</span>
                </div>
                <div className="flex items-center gap-4 w-1/3 justify-end">
                    {/* Timer */}
                    <div className={`px-4 py-2 rounded-lg ${timeRemaining < 60 ? 'bg-red-900/50 animate-pulse' : 'bg-zinc-800/50'}`}>
                        <span className={`text-sm font-mono ${timeRemaining < 60 ? 'text-red-400' : 'text-zinc-400'}`}>
                            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                        </span>
                    </div>

                    <div className="flex flex-col w-full mr-4">
                        <span className="text-xs text-zinc-400 text-right mb-1">Round 2/2 - AI Interview</span>
                        <Progress value={100} className="h-2" />
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleEndInterview} disabled={isGeneratingReport}>
                        {isGeneratingReport ? "Analyzing..." : "End Interview"}
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left: AI Avatar / Chat */}
                <div className="w-1/2 p-6 flex flex-col gap-6">
                    <Card className="flex-1 bg-zinc-900/50 border-zinc-800 p-6 flex flex-col justify-center relative overflow-hidden">
                        {/* Abstract Avatar Visualization */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className={`h-64 w-64 rounded-full ${isAISpeaking ? 'bg-purple-500 animate-pulse' : 'bg-blue-500'} blur-[100px] transition-all duration-500`} />
                        </div>

                        {/* AI Status Indicator */}
                        <div className="z-10 flex flex-col items-center justify-center gap-4">
                            <h2 className="text-3xl font-bold">Zero</h2>
                            <p className="text-zinc-400 text-center text-lg">
                                {isAISpeaking ? "Speaking..." : isRecording ? "Listening..." : "AI Interviewer"}
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Right: User Video */}
                <div className="w-1/2 p-6 flex flex-col gap-6">
                    <div className="relative rounded-2xl overflow-hidden bg-black border border-zinc-800 aspect-video shadow-2xl">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover transform scale-x-[-1] ${!isCameraOn && 'hidden'}`}
                        />

                        {/* Overlays */}
                        <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs font-mono text-green-400 border border-white/10 backdrop-blur-md">
                            {emotion ? `${emotion.label} (${(emotion.score * 100).toFixed(0)}%)` : "Detecting..."}
                        </div>

                        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                            <Button variant="outline" size="icon" className="rounded-full h-12 w-12 bg-black/50 border-white/10 hover:bg-white/20" onClick={() => setIsMicOn(!isMicOn)}>
                                {isMicOn ? <Mic /> : <MicOff className="text-red-500" />}
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full h-12 w-12 bg-black/50 border-white/10 hover:bg-white/20" onClick={() => setIsCameraOn(!isCameraOn)}>
                                {isCameraOn ? <Video /> : <VideoOff className="text-red-500" />}
                            </Button>

                            {/* Interaction Button */}
                            <Button
                                variant={isRecording ? "destructive" : isAISpeaking ? "secondary" : "default"}
                                size="icon"
                                className={`rounded-full h-14 w-14 border-4 border-zinc-900 transition-all duration-300
                                    ${isRecording ? 'animate-pulse bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]' :
                                        isAISpeaking ? 'bg-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.5)]' :
                                            'bg-blue-600 hover:bg-blue-500'}`}
                                onClick={startInteraction}
                                disabled={isAISpeaking}
                            >
                                {isAISpeaking ? (
                                    <div className="flex gap-1 items-center justify-center h-full">
                                        <div className="w-1 h-3 bg-white animate-[bounce_1s_infinite_0ms]" />
                                        <div className="w-1 h-5 bg-white animate-[bounce_1s_infinite_100ms]" />
                                        <div className="w-1 h-3 bg-white animate-[bounce_1s_infinite_200ms]" />
                                    </div>
                                ) : (
                                    <Mic className={`h-6 w-6 ${isRecording ? 'animate-ping' : ''}`} />
                                )}
                            </Button>
                        </div>

                        {/* Closed Captions Overlay */}
                        {closedCaptions && (
                            <div className="absolute bottom-20 left-0 right-0 flex justify-center px-4">
                                <div className="bg-black/80 backdrop-blur-sm px-6 py-3 rounded-lg max-w-[90%]">
                                    <p className="text-white text-center text-lg font-medium">
                                        {closedCaptions}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
