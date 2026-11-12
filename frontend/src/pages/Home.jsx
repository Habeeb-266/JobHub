import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import api from "../services/api";
import JobCard from "../components/JobCard";
import Navbar from "../components/Navbar";

function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // AI Matching state
  const [isAiMatchActive, setIsAiMatchActive] = useState(false);
  const [aiMatches, setAiMatches] = useState([]);
  const [aiCandidateInfo, setAiCandidateInfo] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Load regular jobs
    api
      .get("/jobs/")
      .then((response) => {
        setJobs(response.data.results || []);
      })
      .catch((error) => {
        console.error("Jobs API Error:", error);
        if (error.response) {
          setError(
            `Backend responded with ${error.response.status}: ${
              error.response.data?.detail || "Something went wrong"
            }`
          );
        } else {
          setError("Could not reach the backend server.");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    // Check if redirected with ?ai_match=true
    if (searchParams.get("ai_match") === "true") {
      triggerAiMatch();
    }
  }, [token, searchParams]);

  const triggerAiMatch = async () => {
    setIsAiMatchActive(true);
    setAiLoading(true);
    setAiError("");

    try {
      const res = await api.get("/ai/resume/matches/");
      setAiMatches(res.data.matches || []);
      setAiCandidateInfo({
        name: res.data.candidate_name,
        skillsCount: res.data.skills_count,
        skills: res.data.skills || [],
      });
    } catch (err) {
      console.error("AI Match error:", err);
      if (err.response?.status === 400) {
        setAiError(
          err.response.data?.error || "Please upload a resume first to enable AI matching."
        );
      } else {
        setAiError("Failed to perform vector search matching. Please try again.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleToggleAiMatch = () => {
    if (!isAiMatchActive) {
      triggerAiMatch();
    } else {
      setIsAiMatchActive(false);
      setAiError("");
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const displayedJobs = isAiMatchActive ? aiMatches : jobs;

  return (
    <>
      <Navbar />

      <div className="home-page">
        <section className="hero">
          <h1>Find your next opportunity</h1>
          <p>Discover jobs that match your skills and career goals.</p>

          {/* AI Match Call-to-action Banner */}
          <div className="ai-feature-banner">
            <div className="ai-banner-content">
              <div className="ai-banner-pill">
                <span>⚡ Powered by ChromaDB & SentenceTransformers</span>
              </div>
              <h3>Instant AI Resume Matching</h3>
              <p>
                Our high-dimensional vector search matches your resume's skills and experience
                against open positions in milliseconds.
              </p>
            </div>
            <button
              className={`ai-toggle-btn ${isAiMatchActive ? "active" : ""}`}
              onClick={handleToggleAiMatch}
            >
              {isAiMatchActive ? "✕ Show All Jobs" : "✨ Match with My Resume"}
            </button>
          </div>
        </section>

        <section className="jobs-section">
          <div className="section-header">
            <div>
              <h2>
                {isAiMatchActive ? "🎯 AI Matched Opportunities" : "Available Jobs"}
              </h2>
              {isAiMatchActive && aiCandidateInfo && (
                <p className="ai-candidate-context">
                  Matched for <strong>{aiCandidateInfo.name}</strong> based on {aiCandidateInfo.skillsCount} indexed skills.
                </p>
              )}
            </div>

            <div className="header-meta-group">
              <span className="count-pill">
                {displayedJobs.length} {displayedJobs.length === 1 ? "job" : "jobs"}
              </span>
            </div>
          </div>

          {/* AI Error / Prompt to upload resume */}
          {isAiMatchActive && aiError && (
            <div className="ai-no-resume-alert">
              <div className="alert-body">
                <h4>No Resume Found</h4>
                <p>{aiError}</p>
              </div>
              <button
                className="alert-action-btn"
                onClick={() => navigate("/profile")}
              >
                Upload Resume in Profile →
              </button>
            </div>
          )}

          {/* Loading States */}
          {(loading || (isAiMatchActive && aiLoading)) && (
            <div className="status-message">
              {isAiMatchActive ? "Searching ChromaDB vector store for top matches..." : "Loading jobs..."}
            </div>
          )}

          {error && !isAiMatchActive && (
            <div className="error-message">{error}</div>
          )}

          {/* Empty States */}
          {!loading && !aiLoading && !error && !aiError && displayedJobs.length === 0 && (
            <div className="empty-message">
              <h3>No jobs found</h3>
              <p>
                {isAiMatchActive
                  ? "No vector matches found above threshold. Try updating your skills in Profile."
                  : "Check back later for new opportunities."}
              </p>
            </div>
          )}

          {/* Jobs Grid */}
          {!loading && !aiLoading && !aiError && displayedJobs.length > 0 && (
            <div className="jobs-grid">
              {displayedJobs.map((job) => (
                <JobCard key={job.job_id || job.id} job={{ ...job, id: job.job_id || job.id }} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default Home;