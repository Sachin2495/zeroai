"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const mockCandidates = [
    { id: 1, name: "Alice Johnson", role: "Frontend Dev", score: 88, status: "Recommended", emotion_avg: "Confident" },
    { id: 2, name: "Bob Smith", role: "Backend Dev", score: 72, status: "Review", emotion_avg: "Nervous" },
    { id: 3, name: "Charlie Davis", role: "Fullstack", score: 45, status: "Rejected", emotion_avg: "Neutral" },
]

export default function RecruiterDashboard() {
    return (
        <div className="p-8 space-y-8 bg-zinc-50 dark:bg-zinc-950 min-h-screen text-card-foreground">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Recruiter Dashboard</h1>
                    <p className="text-muted-foreground">Overview of candidate performance and AI Insights.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">128</div>
                        <p className="text-xs text-muted-foreground">+10% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">76.4</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Candidates</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>AI Score</TableHead>
                                <TableHead>Dominant Emotion</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockCandidates.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell>{c.role}</TableCell>
                                    <TableCell>
                                        <span className={c.score > 80 ? 'text-green-500 font-bold' : ''}>{c.score}</span>
                                    </TableCell>
                                    <TableCell>{c.emotion_avg}</TableCell>
                                    <TableCell>
                                        <Badge variant={c.status === "Recommended" ? "default" : "destructive"}>
                                            {c.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
