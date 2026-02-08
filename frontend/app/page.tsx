"use client"

import { useState } from "react";
import CandidateDashboard from "@/components/CandidateDashboard";
import InterviewFlow from "@/components/InterviewFlow";

export default function Home() {
  const [view, setView] = useState<"dashboard" | "interview">("dashboard");
  const [selectedRole, setSelectedRole] = useState("");
  const [domain, setDomain] = useState("");
  const [resumeText, setResumeText] = useState("");

  const handleStart = (role: string, userDomain?: string, resume?: string) => {
    setSelectedRole(role);
    setDomain(userDomain || role); // Use role as domain if not provided
    setResumeText(resume || `Experienced ${role} with various technical skills.`);
    setView("interview");
  };

  return (
    <main>
      {view === "dashboard" ? (
        <CandidateDashboard onStart={handleStart} />
      ) : (
        <InterviewFlow
          role={selectedRole}
          domain={domain}
          resumeText={resumeText}
        />
      )}
    </main>
  );
}
