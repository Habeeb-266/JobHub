
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function RecruiterDashboard() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // AI Talent Matching state
  const [activeAiJob, setActiveAiJob] = useState(null);
  const [aiCandidates, setAiCandidates] = useState([]);
  const [aiCandidateLoading, setAiCandidateLoading] = useState(false);
  const [aiCandidateError, setAiCandidateError] = useState("");

  const handleOpenAiMatches = async (job) => {
    setActiveAiJob(job);
    setAiCandidateLoading(true);
    setAiCandidateError("");
    setAiCandidates([]);

    try {
      const res = await api.get(`/ai/jobs/${job.id}/candidates/`);
      setAiCandidates(res.data.candidate_matches || []);
    } catch (err) {
      console.error("Failed to load candidate matches:", err);
      setAiCandidateError(err.response?.data?.error || "Failed to load candidate matches.");
    } finally {
      setAiCandidateLoading(false);
    }
  };

  const token = localStorage.getItem("access_token");

  const user = JSON.parse(
    localStorage.getItem("user") || "null"
  );

  useEffect(() => {
    if (!token || !user) {
      setLoading(false);
      return;
    }

    if (user.role !== "recruiter") {
      setLoading(false);
      return;
    }

    api
      .get("/jobs/")
      .then((response) => {
        console.log("Recruiter jobs:", response.data);

        const allJobs =
          response.data.results || response.data;

        const myJobs = allJobs.filter(
          (job) => job.recruiter === user.username
        );

        setJobs(myJobs);
      })
      .catch((error) => {
        console.error(
          "Recruiter jobs error:",
          error
        );

        if (error.response) {
          setError(
            error.response.data?.detail ||
              `Unable to load jobs (${error.response.status})`
          );
        } else {
          setError(
            "Could not reach the backend server."
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, user?.username, user?.role]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "recruiter") {
    return <Navigate to="/" replace />;
  }

  const handleDeleteJob = async (jobId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this job?"
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await api.delete(`/jobs/${jobId}/`);

      console.log("Job deleted:", jobId);

      setJobs((currentJobs) =>
        currentJobs.filter(
          (job) => job.id !== jobId
        )
      );
    } catch (error) {
      console.error(
        "Delete job error:",
        error
      );

      if (error.response) {
        setError(
          error.response.data?.detail ||
            `Unable to delete job (${error.response.status})`
        );
      } else {
        setError(
          "Could not reach the backend server."
        );
      }
    }
  };

  return (
    <>
      <Navbar />

      <main className="recruiter-dashboard">
        <div className="recruiter-container">

          {/* Dashboard Header */}
          <div className="recruiter-header">

            <div>
              <h1>Recruiter Dashboard</h1>

              <p>
                Manage your job postings and
                applications.
              </p>
            </div>

            <button
              className="create-job-button"
              onClick={() =>
                navigate(
                  "/recruiter/jobs/create"
                )
              }
            >
              + Create New Job
            </button>

          </div>

          {/* My Jobs */}
          <section className="my-jobs-section">

            <div className="section-header">

              <h2>My Jobs</h2>

              <span>
                {jobs.length}{" "}
                {jobs.length === 1
                  ? "job"
                  : "jobs"}
              </span>

            </div>

            {/* Loading */}
            {loading && (
              <div className="status-message">
                Loading your jobs...
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* No Jobs */}
            {!loading &&
              !error &&
              jobs.length === 0 && (
                <div className="empty-message">

                  <h3>
                    No jobs posted yet
                  </h3>

                  <p>
                    Create your first job
                    posting to get started.
                  </p>

                  <button
                    className="browse-jobs-button"
                    onClick={() =>
                      navigate(
                        "/recruiter/jobs/create"
                      )
                    }
                  >
                    Create Job
                  </button>

                </div>
              )}

            {/* Jobs List */}
            {!loading &&
              !error &&
              jobs.length > 0 && (
                <div className="recruiter-jobs-list">

                  {jobs.map((job) => (
                    <article
                      className="recruiter-job-card"
                      key={job.id}
                    >

                      {/* Job Information */}
                      <div className="recruiter-job-main">

                        <h3>
                          {job.title}
                        </h3>

                        <p className="company-name">
                          {job.company}
                        </p>

                        <div className="job-info">

                          {job.location && (
                            <span>
                              📍{" "}
                              {job.location}
                            </span>
                          )}

                          {job.job_type && (
                            <span>
                              💼{" "}
                              {job.job_type
                                .split("_")
                                .map(
                                  (word) =>
                                    word
                                      .charAt(0)
                                      .toUpperCase() +
                                    word.slice(1)
                                )
                                .join(" ")}
                            </span>
                          )}

                          {job.experience && (
                            <span>
                              🧑‍💻{" "}
                              {job.experience}
                            </span>
                          )}

                        </div>

                        {job.salary && (
                          <p className="job-salary">
                            ₹
                            {Number(
                              job.salary
                            ).toLocaleString(
                              "en-IN"
                            )}
                            <span>
                              {" "}
                              / month
                            </span>
                          </p>
                        )}

                      </div>

                      {/* Job Actions */}
                      <div className="recruiter-job-actions">

                        <button
                          onClick={() =>
                            navigate(
                              `/jobs/${job.id}`
                            )
                          }
                        >
                          View
                        </button>

                        <button
                          onClick={() =>
                            navigate(
                              `/recruiter/jobs/${job.id}/edit`
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            navigate(
                              "/applications"
                            )
                          }
                        >
                          Applications
                        </button>

                        <button
                          className="ai-matches-button"
                          onClick={() => handleOpenAiMatches(job)}
                          title="Search candidates matching this job in ChromaDB"
                        >
                          ⚡ AI Talent
                        </button>

                        <button
                          className="delete-job-button"
                          onClick={() =>
                            handleDeleteJob(
                              job.id
                            )
                          }
                        >
                          Delete
                        </button>

                      </div>

                    </article>
                  ))}

                </div>
              )}

          </section>

        </div>

        {/* AI Talent Match Modal */}
        {activeAiJob && (
          <div className="modal-overlay" onClick={() => setActiveAiJob(null)}>
            <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="ai-modal-header">
                <div>
                  <span className="ai-modal-badge">ChromaDB Vector Retrieval</span>
                  <h3>AI Talent Matches for: {activeAiJob.title}</h3>
                </div>
                <button className="modal-close-btn" onClick={() => setActiveAiJob(null)}>
                  ✕
                </button>
              </div>

              <div className="ai-modal-body">
                {aiCandidateLoading && (
                  <div className="status-message">
                    Scanning vector space for top matching candidate profiles...
                  </div>
                )}

                {aiCandidateError && (
                  <div className="error-message">{aiCandidateError}</div>
                )}

                {!aiCandidateLoading && !aiCandidateError && aiCandidates.length === 0 && (
                  <div className="empty-message">
                    <h4>No vector matches yet</h4>
                    <p>No candidates have uploaded resumes or matched this job profile.</p>
                  </div>
                )}

                {!aiCandidateLoading && aiCandidates.length > 0 && (
                  <div className="ai-candidates-list">
                    {aiCandidates.map((c) => (
                      <div key={c.user_id} className="candidate-match-card">
                        <div className="candidate-match-top">
                          <div>
                            <h4>{c.full_name || c.username}</h4>
                            <span className="candidate-meta">
                              🧑‍💻 {c.experience_years} years exp • {c.skill_count} skills indexed
                            </span>
                          </div>
                          <div className="candidate-score-badge">
                            ⚡ {c.match_score}% Match
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default RecruiterDashboard;

