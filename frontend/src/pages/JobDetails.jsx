import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [resumeFile, setResumeFile] = useState(null);
  const [profileResumeName, setProfileResumeName] = useState("");
  const [useProfileResume, setUseProfileResume] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [applyError, setApplyError] = useState("");

  const token = localStorage.getItem("access_token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isCandidate = user?.role === "candidate";
  const isRecruiter = user?.role === "recruiter";

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // 1. Fetch job details
    api
      .get(`/jobs/${id}/`)
      .then((response) => {
        setJob(response.data);
      })
      .catch((error) => {
        console.error("Job details error:", error);
        if (error.response) {
          setError(
            error.response.data?.detail ||
              `Unable to load job (${error.response.status})`
          );
        } else {
          setError("Could not reach the backend server.");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    // 2. If candidate, check if already applied and check profile resume
    if (isCandidate) {
      api
        .get("/applications/")
        .then((res) => {
          const list = res.data.results || res.data || [];
          const match = list.find((app) => String(app.job) === String(id));
          if (match) {
            setHasApplied(true);
          }
        })
        .catch(() => {});

      api
        .get("/ai/resume/me/")
        .then((res) => {
          if (res.data.has_resume && res.data.profile?.resume_file) {
            const raw = res.data.profile.resume_file;
            const filename = raw.split("/").pop() || "Profile Resume.pdf";
            setProfileResumeName(filename);
            setUseProfileResume(true);
          }
        })
        .catch(() => {});
    }
  }, [id, token, isCandidate]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const formatJobType = (type) => {
    if (!type) return "";
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatSalary = (salary) => {
    if (!salary) return "";
    const amount = Number(salary);
    if (Number.isNaN(amount)) {
      return salary;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setApplyError("");
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx")) {
      setApplyError("Invalid file type. Only PDF and DOCX files are supported.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setApplyError("File size exceeds 10MB limit.");
      return;
    }

    setResumeFile(file);
    setUseProfileResume(false);
  };

  const handleApply = async (e) => {
    if (e) e.preventDefault();
    setApplying(true);
    setApplyMessage("");
    setApplyError("");

    // Validate that a resume is provided
    if (!resumeFile && (!useProfileResume || !profileResumeName)) {
      setApplyError("Please upload your resume (.pdf or .docx) to apply for this job.");
      setApplying(false);
      return;
    }

    const formData = new FormData();
    formData.append("job", job.id);
    if (resumeFile) {
      formData.append("resume", resumeFile);
    }

    try {
      const response = await api.post("/applications/apply/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Application created:", response.data);
      setHasApplied(true);
      setApplyMessage("Application submitted successfully with your resume! Recruiters will screen your application.");
    } catch (error) {
      console.error("Application error:", error.response?.data);
      if (error.response?.data) {
        const data = error.response.data;
        if (data.detail) {
          setApplyError(data.detail);
        } else if (data.resume) {
          setApplyError(Array.isArray(data.resume) ? data.resume[0] : data.resume);
        } else if (data.job) {
          setApplyError(Array.isArray(data.job) ? data.job[0] : data.job);
        } else if (Array.isArray(data) && data[0]) {
          setApplyError(data[0]);
        } else {
          setApplyError("Unable to submit application.");
        }
      } else {
        setApplyError("Could not reach the backend server.");
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="job-details-page">
        {loading && (
          <div className="status-message">
            Loading job details...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!loading && !error && job && (
          <section className="job-details-card">
            <button
              className="back-button"
              onClick={() => navigate(isRecruiter ? "/recruiter" : "/")}
            >
              ← Back to {isRecruiter ? "Dashboard" : "Jobs"}
            </button>

            <div className="job-details-header">
              <div className="company-logo large">
                {job.company?.charAt(0)?.toUpperCase() || "J"}
              </div>

              <div>
                <h1>{job.title}</h1>
                <p className="company-name">{job.company}</p>
              </div>
            </div>

            <div className="job-details-info">
              {job.location && <span>📍 {job.location}</span>}
              {job.job_type && <span>💼 {formatJobType(job.job_type)}</span>}
              {job.experience && <span>🧑‍💻 {job.experience}</span>}
            </div>

            {job.salary && (
              <div className="job-details-salary">
                {formatSalary(job.salary)}
                <span> / month</span>
              </div>
            )}

            <div className="job-details-section">
              <h2>Job Description</h2>
              <p>{job.description}</p>
            </div>

            {job.recruiter && (
              <div className="job-details-section">
                <h2>Posted By</h2>
                <p>{job.recruiter}</p>
              </div>
            )}

            {/* Application Section */}
            {isCandidate && (
              <div className="apply-resume-container">
                <h3>Submit Your Application</h3>
                <p className="apply-instruction">
                  Recruiters use ATS resume screening to evaluate skills match against this job. Please ensure your resume is up to date.
                </p>

                {hasApplied ? (
                  <div className="applied-banner">
                    <span className="applied-check">✓</span>
                    <div>
                      <strong>You have already applied for this position.</strong>
                      <p>You can track the progress and status in your applications tab.</p>
                    </div>
                    <button
                      className="view-application-button"
                      onClick={() => navigate("/applications")}
                    >
                      Track Application
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApply} className="apply-form-box">
                    {/* Profile resume option */}
                    {profileResumeName && (
                      <div className="profile-resume-option">
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="resumeChoice"
                            checked={useProfileResume}
                            onChange={() => {
                              setUseProfileResume(true);
                              setResumeFile(null);
                            }}
                          />
                          <span>
                            Use resume from your profile (<strong>{profileResumeName}</strong>)
                          </span>
                        </label>

                        <label className="radio-label">
                          <input
                            type="radio"
                            name="resumeChoice"
                            checked={!useProfileResume}
                            onChange={() => setUseProfileResume(false)}
                          />
                          <span>Upload a new resume for this application (.pdf or .docx)</span>
                        </label>
                      </div>
                    )}

                    {/* File upload input */}
                    {(!profileResumeName || !useProfileResume) && (
                      <div className="file-upload-dropzone">
                        <input
                          type="file"
                          id="resume-file-input"
                          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleFileChange}
                          style={{ display: "none" }}
                        />
                        <label htmlFor="resume-file-input" className="file-upload-label">
                          <div className="upload-icon">📄</div>
                          <div className="upload-text">
                            <strong>{resumeFile ? resumeFile.name : "Click to select your Resume"}</strong>
                            <span>{resumeFile ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB • Click to change` : "Supported formats: PDF, DOCX (Max 10MB)"}</span>
                          </div>
                        </label>
                      </div>
                    )}

                    {applyMessage && (
                      <div className="success-message">
                        {applyMessage}
                      </div>
                    )}

                    {applyError && (
                      <div className="error-message">
                        {applyError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="apply-button"
                      disabled={applying || (!resumeFile && (!useProfileResume || !profileResumeName))}
                    >
                      {applying ? "Submitting Application..." : "Submit Application with Resume"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {isRecruiter && (
              <div className="recruiter-notice-box">
                <p>
                  <strong>Recruiter View:</strong> You posted this job. You can review candidate applications and run ATS resume scans from the <button className="inline-link-button" onClick={() => navigate("/applications")}>Applications Dashboard</button>.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}

export default JobDetails;
