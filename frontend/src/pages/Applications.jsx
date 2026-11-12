import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

const STATUS_LABELS = {
  applied: "Applied",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview Scheduled",
  selected: "Selected",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  pending: "Pending (Applied)",
  hired: "Hired (Selected)",
};

const RECRUITER_TRANSITIONS = {
  applied: ["under_review", "shortlisted", "rejected"],
  pending: ["under_review", "shortlisted", "rejected"],
  under_review: ["shortlisted", "interview_scheduled", "rejected"],
  shortlisted: ["interview_scheduled", "selected", "rejected"],
  interview_scheduled: ["selected", "shortlisted", "rejected"],
  selected: ["rejected", "interview_scheduled"],
  hired: ["rejected"],
  rejected: ["under_review"],
  withdrawn: [],
};

function Applications() {
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Tracking operations per application ID
  const [scanningId, setScanningId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Expanded detail panels (e.g. ATS details or status history)
  const [expandedAts, setExpandedAts] = useState({});
  const [expandedHistory, setExpandedHistory] = useState({});
  const [reviewForms, setReviewForms] = useState({}); // { [appId]: { status, internal_notes, candidate_feedback } }

  const token = localStorage.getItem("access_token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isRecruiter = user?.role === "recruiter";

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetchApplications();
  }, [token]);

  const fetchApplications = () => {
    setLoading(true);
    api
      .get("/applications/")
      .then((response) => {
        const list = response.data.results || response.data || [];
        setApplications(list);

        // Pre-fill review forms state for recruiters
        const forms = {};
        list.forEach((app) => {
          forms[app.id] = {
            status: app.status,
            internal_notes: app.internal_notes || "",
            candidate_feedback: app.candidate_feedback || "",
          };
        });
        setReviewForms(forms);
      })
      .catch((err) => {
        console.error("Applications error:", err);
        if (err.response) {
          setError(
            err.response.data?.detail ||
              `Unable to load applications (${err.response.status})`
          );
        } else {
          setError("Could not reach the backend server.");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const formatStatus = (status) => {
    return STATUS_LABELS[status] || status.replace("_", " ").toUpperCase();
  };

  // Secure resume view
  const handleViewResume = async (appId) => {
    setDownloadingId(appId);
    setError("");
    try {
      const response = await api.get(`/applications/${appId}/resume/`, {
        responseType: "blob",
      });
      const contentType = response.headers["content-type"] || "application/pdf";
      const blob = new Blob([response.data], { type: contentType });
      const fileUrl = URL.createObjectURL(blob);
      window.open(fileUrl, "_blank");
    } catch (err) {
      console.error("View resume error:", err);
      setError("Unable to preview resume file. Please try downloading.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Secure resume download
  const handleDownloadResume = async (appId, filename = "candidate_resume.pdf") => {
    setDownloadingId(appId);
    setError("");
    try {
      const response = await api.get(`/applications/${appId}/resume/?download=1`, {
        responseType: "blob",
      });
      const contentType = response.headers["content-type"] || "application/octet-stream";
      const blob = new Blob([response.data], { type: contentType });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", filename || "candidate_resume.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Download resume error:", err);
      setError("Unable to download resume file.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Run ATS Resume Screening
  const handleRunAtsScan = async (appId) => {
    setScanningId(appId);
    setError("");
    setSuccessMsg("");

    try {
      const response = await api.post(`/applications/${appId}/scan/`);
      const newAtsResult = response.data;

      // Update state with new ATS result
      setApplications((current) =>
        current.map((app) =>
          app.id === appId ? { ...app, ats_result: newAtsResult } : app
        )
      );

      // Auto-expand ATS section for this application
      setExpandedAts((prev) => ({ ...prev, [appId]: true }));
      setSuccessMsg(`ATS scan completed for Application #${appId}! Overall Match: ${newAtsResult.overall_score}%`);
    } catch (err) {
      console.error("ATS Scan error:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Failed to run ATS screening on this resume."
      );
    } finally {
      setScanningId(null);
    }
  };

  // Recruiter form state changes
  const handleFormChange = (appId, field, value) => {
    setReviewForms((prev) => ({
      ...prev,
      [appId]: {
        ...prev[appId],
        [field]: value,
      },
    }));
  };

  // Recruiter Updates Status
  const handleUpdateStatus = async (appId) => {
    const formData = reviewForms[appId];
    if (!formData) return;

    setUpdatingId(appId);
    setError("");
    setSuccessMsg("");

    try {
      const response = await api.patch(`/applications/${appId}/`, {
        status: formData.status,
        internal_notes: formData.internal_notes,
        candidate_feedback: formData.candidate_feedback,
      });

      setApplications((current) =>
        current.map((app) => (app.id === appId ? response.data : app))
      );

      setSuccessMsg(`Application #${appId} status updated to '${formatStatus(formData.status)}'`);
    } catch (err) {
      console.error("Update status error:", err);
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === "string") setError(data);
        else if (data.detail) setError(data.detail);
        else if (data.status) setError(Array.isArray(data.status) ? data.status[0] : data.status);
        else setError("Failed to update status. Please verify transition rules.");
      } else {
        setError("Could not reach backend server.");
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // Candidate Withdraws Application
  const handleWithdrawApplication = async (appId) => {
    const confirmed = window.confirm(
      "Are you sure you want to withdraw your application? This action cannot be undone."
    );
    if (!confirmed) return;

    setWithdrawingId(appId);
    setError("");
    setSuccessMsg("");

    try {
      const response = await api.patch(`/applications/${appId}/`, {
        status: "withdrawn",
      });

      setApplications((current) =>
        current.map((app) => (app.id === appId ? response.data : app))
      );

      setSuccessMsg("Application withdrawn successfully.");
    } catch (err) {
      console.error("Withdraw error:", err);
      setError(
        err.response?.data?.detail || "Failed to withdraw application."
      );
    } finally {
      setWithdrawingId(null);
    }
  };

  const getScoreColorClass = (score) => {
    if (score >= 75) return "score-high";
    if (score >= 50) return "score-medium";
    return "score-low";
  };

  return (
    <>
      <Navbar />

      <main className="applications-page">
        <div className="applications-container">
          <div className="applications-header">
            <div>
              <h1>
                {isRecruiter ? "Application Review & ATS Screening" : "My Applications"}
              </h1>
              <p>
                {isRecruiter
                  ? "Scan candidate resumes with the ATS system, inspect skill matches, and manage application statuses."
                  : "Track the progress, recruiter feedback, and status history of your submitted applications."}
              </p>
            </div>
          </div>

          {loading && (
            <div className="status-message">Loading applications...</div>
          )}

          {error && <div className="error-message">{error}</div>}
          {successMsg && <div className="success-message">{successMsg}</div>}

          {!loading && !error && applications.length === 0 && (
            <div className="empty-message">
              {isRecruiter ? (
                <>
                  <h3>No applications received</h3>
                  <p>Candidates haven't applied for your jobs yet.</p>
                  <button
                    className="browse-jobs-button"
                    onClick={() => navigate("/recruiter")}
                  >
                    Back to Dashboard
                  </button>
                </>
              ) : (
                <>
                  <h3>No applications yet</h3>
                  <p>You haven't applied for any jobs yet.</p>
                  <button
                    className="browse-jobs-button"
                    onClick={() => navigate("/")}
                  >
                    Browse Jobs
                  </button>
                </>
              )}
            </div>
          )}

          {!loading && applications.length > 0 && (
            <div className="applications-list">
              {applications.map((application) => {
                const ats = application.ats_result;
                const form = reviewForms[application.id] || {
                  status: application.status,
                  internal_notes: application.internal_notes || "",
                  candidate_feedback: application.candidate_feedback || "",
                };
                const allowedTransitions =
                  RECRUITER_TRANSITIONS[application.status] || [];
                const isWithdrawn = application.status === "withdrawn";
                const isScanning = scanningId === application.id;
                const isUpdating = updatingId === application.id;
                const isDownloading = downloadingId === application.id;

                return (
                  <article
                    className={`application-card-enhanced ${
                      isRecruiter ? "recruiter-card" : "candidate-card"
                    }`}
                    key={application.id}
                  >
                    {/* Header Row */}
                    <div className="app-card-header">
                      <div className="app-card-title-area">
                        <h2>{application.job_title}</h2>
                        {application.company && (
                          <span className="app-company-name">
                            {application.company}
                          </span>
                        )}
                        <span className="app-id-pill">
                          App #{application.id}
                        </span>
                      </div>

                      <div className="app-header-right">
                        <span
                          className={`status-badge status-${application.status}`}
                        >
                          {formatStatus(application.status)}
                        </span>
                        <span className="app-applied-date">
                          Applied:{" "}
                          {new Date(
                            application.applied_at
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Candidate Identity (Recruiter view) */}
                    {isRecruiter && (
                      <div className="candidate-meta-bar">
                        <div className="candidate-info-cell">
                          <span className="meta-label">Candidate</span>
                          <strong>{application.candidate}</strong>
                        </div>
                        <div className="candidate-info-cell">
                          <span className="meta-label">Email</span>
                          <span>{application.candidate_email || "N/A"}</span>
                        </div>
                        <div className="candidate-info-cell">
                          <span className="meta-label">Resume Document</span>
                          <span className="resume-filename-tag">
                            📄 {application.resume_filename || "Attached Resume"}
                          </span>
                        </div>

                        {/* Resume Actions */}
                        <div className="candidate-resume-actions">
                          <button
                            type="button"
                            className="resume-action-btn view-btn"
                            onClick={() => handleViewResume(application.id)}
                            disabled={isDownloading}
                            title="Preview resume in new tab"
                          >
                            👁️ View Resume
                          </button>
                          <button
                            type="button"
                            className="resume-action-btn download-btn"
                            onClick={() =>
                              handleDownloadResume(
                                application.id,
                                application.resume_filename
                              )
                            }
                            disabled={isDownloading}
                            title="Download original resume file"
                          >
                            ⬇️ Download
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Candidate Self View: Resume Info */}
                    {!isRecruiter && (
                      <div className="candidate-self-resume-bar">
                        <div className="resume-info-block">
                          <span>Submitted Resume:</span>
                          <strong>
                            📄 {application.resume_filename || "Resume Document"}
                          </strong>
                        </div>
                        <div className="resume-self-actions">
                          <button
                            type="button"
                            className="resume-action-btn view-btn small"
                            onClick={() => handleViewResume(application.id)}
                            disabled={isDownloading}
                          >
                            👁️ View My Resume
                          </button>
                          <button
                            type="button"
                            className="resume-action-btn download-btn small"
                            onClick={() =>
                              handleDownloadResume(
                                application.id,
                                application.resume_filename
                              )
                            }
                            disabled={isDownloading}
                          >
                            ⬇️ Download
                          </button>
                        </div>
                      </div>
                    )}

                    {/* RECRUITER ONLY: ATS RESUME SCREENING SECTION */}
                    {isRecruiter && (
                      <div className="ats-screening-module">
                        <div className="ats-module-header">
                          <div className="ats-module-title">
                            <h3>⚡ ATS Resume Screening</h3>
                            {ats && (
                              <span
                                className={`ats-score-pill ${getScoreColorClass(
                                  ats.overall_score
                                )}`}
                              >
                                {ats.overall_score}% Match
                              </span>
                            )}
                          </div>

                          <div className="ats-actions">
                            <button
                              type="button"
                              className="ats-scan-button"
                              onClick={() => handleRunAtsScan(application.id)}
                              disabled={isScanning}
                            >
                              {isScanning ? (
                                <>⏳ Scanning Resume...</>
                              ) : ats ? (
                                <>🔄 Re-scan ATS</>
                              ) : (
                                <>🔍 Scan Resume with ATS</>
                              )}
                            </button>

                            {ats && (
                              <button
                                type="button"
                                className="toggle-details-btn"
                                onClick={() =>
                                  setExpandedAts((prev) => ({
                                    ...prev,
                                    [application.id]: !prev[application.id],
                                  }))
                                }
                              >
                                {expandedAts[application.id]
                                  ? "Hide Breakdown ▲"
                                  : "View Breakdown ▼"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ATS Result Summary or Empty Notice */}
                        {!ats && !isScanning && (
                          <div className="ats-prompt-notice">
                            <p>
                              Resume has not been scanned yet. Click <strong>"Scan Resume with ATS"</strong> above to extract skills, compare qualifications, and compute a transparent match score.
                            </p>
                          </div>
                        )}

                        {ats && (
                          <div className="ats-summary-grid">
                            {/* Score Card */}
                            <div className="ats-score-box">
                              <div
                                className={`score-circle ${getScoreColorClass(
                                  ats.overall_score
                                )}`}
                              >
                                <span className="score-number">
                                  {Math.round(ats.overall_score)}%
                                </span>
                                <span className="score-subtext">Overall</span>
                              </div>
                              <div className="extraction-status-tag">
                                {ats.extraction_status === "success" && (
                                  <span className="tag-success">
                                    ✓ Text Parsed
                                  </span>
                                )}
                                {ats.extraction_status === "scanned_pdf" && (
                                  <span className="tag-warning">
                                    ⚠️ Scanned Document
                                  </span>
                                )}
                                {ats.extraction_status === "failed" && (
                                  <span className="tag-danger">
                                    ✕ Extraction Failed
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Skills Matched & Missing */}
                            <div className="ats-skills-panel">
                              <div className="skills-column">
                                <span className="skills-column-title matched">
                                  ✓ Matched Skills ({ats.matched_skills.length})
                                </span>
                                <div className="skills-tags-wrap">
                                  {ats.matched_skills.length > 0 ? (
                                    ats.matched_skills.map((skill, idx) => (
                                      <span
                                        className="skill-tag matched"
                                        key={idx}
                                      >
                                        ✓ {skill}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="empty-subtext">
                                      No direct required skills matched
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="skills-column">
                                <span className="skills-column-title missing">
                                  ✕ Missing Skills ({ats.missing_skills.length})
                                </span>
                                <div className="skills-tags-wrap">
                                  {ats.missing_skills.length > 0 ? (
                                    ats.missing_skills.map((skill, idx) => (
                                      <span
                                        className="skill-tag missing"
                                        key={idx}
                                      >
                                        ✕ {skill}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="empty-subtext">
                                      All required job skills matched!
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Detailed ATS Breakdown (Expandable) */}
                        {ats && expandedAts[application.id] && (
                          <div className="ats-expanded-details">
                            {ats.extraction_error && (
                              <div className="ats-warning-banner">
                                <strong>Extraction Note:</strong>{" "}
                                {ats.extraction_error}
                              </div>
                            )}

                            <h4>Scoring Breakdown</h4>
                            <div className="breakdown-grid">
                              <div className="breakdown-item">
                                <span className="breakdown-label">
                                  Required Skills (50%)
                                </span>
                                <div className="breakdown-bar-bg">
                                  <div
                                    className="breakdown-bar-fill"
                                    style={{
                                      width: `${
                                        ((ats.score_breakdown?.skills_score || 0) /
                                          50) *
                                        100
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="breakdown-value">
                                  {ats.score_breakdown?.skills_score || 0} / 50 pts
                                </span>
                              </div>

                              <div className="breakdown-item">
                                <span className="breakdown-label">
                                  Keywords Match (25%)
                                </span>
                                <div className="breakdown-bar-bg">
                                  <div
                                    className="breakdown-bar-fill"
                                    style={{
                                      width: `${
                                        ((ats.score_breakdown?.keywords_score ||
                                          0) /
                                          25) *
                                        100
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="breakdown-value">
                                  {ats.score_breakdown?.keywords_score || 0} / 25 pts
                                </span>
                              </div>

                              <div className="breakdown-item">
                                <span className="breakdown-label">
                                  Experience Match (15%)
                                </span>
                                <div className="breakdown-bar-bg">
                                  <div
                                    className="breakdown-bar-fill"
                                    style={{
                                      width: `${
                                        ((ats.score_breakdown
                                          ?.experience_score || 0) /
                                          15) *
                                        100
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="breakdown-value">
                                  {ats.score_breakdown?.experience_score || 0} / 15 pts
                                </span>
                              </div>

                              <div className="breakdown-item">
                                <span className="breakdown-label">
                                  Education & Degree (10%)
                                </span>
                                <div className="breakdown-bar-bg">
                                  <div
                                    className="breakdown-bar-fill"
                                    style={{
                                      width: `${
                                        ((ats.score_breakdown?.education_score ||
                                          0) /
                                          10) *
                                        100
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="breakdown-value">
                                  {ats.score_breakdown?.education_score || 0} / 10 pts
                                </span>
                              </div>
                            </div>

                            {ats.relevant_keywords &&
                              ats.relevant_keywords.length > 0 && (
                                <div className="keywords-wrap">
                                  <span className="keywords-label">
                                    Relevant Keywords:
                                  </span>
                                  {ats.relevant_keywords.map((kw, i) => (
                                    <span className="keyword-chip" key={i}>
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* RECRUITER ONLY: STATUS UPDATE WORKFLOW FORM */}
                    {isRecruiter && (
                      <div className="status-update-workflow-box">
                        <div className="workflow-title-row">
                          <h4>Application Status & Review</h4>
                          <button
                            type="button"
                            className="history-toggle-link"
                            onClick={() =>
                              setExpandedHistory((prev) => ({
                                ...prev,
                                [application.id]: !prev[application.id],
                              }))
                            }
                          >
                            {expandedHistory[application.id]
                              ? "Hide Status History ▲"
                              : `Status History (${
                                  application.status_history?.length || 0
                                }) ▼`}
                          </button>
                        </div>

                        <div className="status-form-inputs">
                          <div className="status-select-wrap">
                            <label>Next Status</label>
                            <select
                              value={form.status}
                              onChange={(e) =>
                                handleFormChange(
                                  application.id,
                                  "status",
                                  e.target.value
                                )
                              }
                              disabled={isWithdrawn}
                            >
                              <option value={application.status}>
                                Current: {formatStatus(application.status)}
                              </option>
                              {allowedTransitions.map((st) => (
                                <option key={st} value={st}>
                                  → {formatStatus(st)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="notes-wrap">
                            <label>
                              🔒 Internal Review Notes (Private to Recruiters)
                            </label>
                            <input
                              type="text"
                              placeholder="Add private evaluation notes..."
                              value={form.internal_notes}
                              onChange={(e) =>
                                handleFormChange(
                                  application.id,
                                  "internal_notes",
                                  e.target.value
                                )
                              }
                              disabled={isWithdrawn}
                            />
                          </div>

                          <div className="notes-wrap">
                            <label>
                              📢 Candidate Feedback (Visible to Candidate)
                            </label>
                            <input
                              type="text"
                              placeholder="Feedback shared with candidate..."
                              value={form.candidate_feedback}
                              onChange={(e) =>
                                handleFormChange(
                                  application.id,
                                  "candidate_feedback",
                                  e.target.value
                                )
                              }
                              disabled={isWithdrawn}
                            />
                          </div>

                          <div className="status-submit-actions">
                            <button
                              type="button"
                              className="update-status-btn"
                              onClick={() =>
                                handleUpdateStatus(application.id)
                              }
                              disabled={isUpdating || isWithdrawn}
                            >
                              {isUpdating
                                ? "Updating..."
                                : "Update Status"}
                            </button>

                            <button
                              type="button"
                              className="view-job-btn"
                              onClick={() =>
                                navigate(`/jobs/${application.job}`)
                              }
                            >
                              View Job
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CANDIDATE VIEW: STATUS & RECRUITER FEEDBACK */}
                    {!isRecruiter && (
                      <div className="candidate-feedback-box">
                        {application.candidate_feedback ? (
                          <div className="feedback-banner">
                            <div className="feedback-icon">💬</div>
                            <div className="feedback-content">
                              <strong>Recruiter Feedback:</strong>
                              <p>{application.candidate_feedback}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="no-feedback-text">
                            No direct feedback provided by recruiter yet.
                          </p>
                        )}

                        <div className="candidate-card-bottom-actions">
                          <button
                            type="button"
                            className="history-toggle-link"
                            onClick={() =>
                              setExpandedHistory((prev) => ({
                                ...prev,
                                [application.id]: !prev[application.id],
                              }))
                            }
                          >
                            {expandedHistory[application.id]
                              ? "Hide Status History ▲"
                              : `Status History (${
                                  application.status_history?.length || 0
                                }) ▼`}
                          </button>

                          <div className="candidate-right-buttons">
                            <button
                              type="button"
                              className="view-job-btn"
                              onClick={() =>
                                navigate(`/jobs/${application.job}`)
                              }
                            >
                              View Job
                            </button>

                            {application.status !== "withdrawn" &&
                              application.status !== "rejected" &&
                              application.status !== "selected" && (
                                <button
                                  type="button"
                                  className="withdraw-app-btn"
                                  onClick={() =>
                                    handleWithdrawApplication(
                                      application.id
                                    )
                                  }
                                  disabled={
                                    withdrawingId === application.id
                                  }
                                >
                                  {withdrawingId === application.id
                                    ? "Withdrawing..."
                                    : "Withdraw Application"}
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STATUS HISTORY TIMELINE (EXPANDABLE) */}
                    {expandedHistory[application.id] && (
                      <div className="status-history-timeline">
                        <h4>Status Change History</h4>
                        {application.status_history &&
                        application.status_history.length > 0 ? (
                          <ul className="timeline-list">
                            {application.status_history.map(
                              (history, idx) => (
                                <li className="timeline-item" key={idx}>
                                  <div className="timeline-marker"></div>
                                  <div className="timeline-content">
                                    <div className="timeline-top">
                                      <strong>
                                        {formatStatus(history.new_status)}
                                      </strong>
                                      {history.previous_status && (
                                        <span className="prev-status">
                                          (from{" "}
                                          {formatStatus(
                                            history.previous_status
                                          )}
                                          )
                                        </span>
                                      )}
                                      <span className="timeline-time">
                                        {new Date(
                                          history.changed_at
                                        ).toLocaleString("en-IN", {
                                          dateStyle: "medium",
                                          timeStyle: "short",
                                        })}
                                      </span>
                                    </div>

                                    {history.changed_by_username && (
                                      <span className="timeline-author">
                                        Updated by:{" "}
                                        {history.changed_by_username}
                                      </span>
                                    )}

                                    {/* Recruiter internal note in history */}
                                    {isRecruiter && history.notes && (
                                      <p className="timeline-internal-note">
                                        🔒 Internal Note: {history.notes}
                                      </p>
                                    )}

                                    {/* Candidate feedback in history */}
                                    {history.candidate_feedback && (
                                      <p className="timeline-feedback">
                                        📢 Feedback:{" "}
                                        {history.candidate_feedback}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              )
                            )}
                          </ul>
                        ) : (
                          <p className="no-history-text">
                            No status changes recorded yet.
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default Applications;
