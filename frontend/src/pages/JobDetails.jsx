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

const [applying, setApplying] = useState(false);
const [applyMessage, setApplyMessage] = useState("");
const [applyError, setApplyError] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get(`/jobs/${id}/`)
      .then((response) => {
        console.log("Job details:", response.data);
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
  }, [id, token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const formatJobType = (type) => {
    if (!type) return "";

    return type
      .split("_")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() + word.slice(1)
      )
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
  const handleApply = async () => {
  setApplying(true);
  setApplyMessage("");
  setApplyError("");

  try {
    const response = await api.post(
      "/applications/apply/",
      {
        job: job.id,
      }
    );

    console.log(
      "Application created:",
      response.data
    );

    setApplyMessage(
      "Application submitted successfully!"
    );
  } catch (error) {
    console.error(
      "Application error:",
      error.response?.data
    );

    if (error.response?.data) {
      const data = error.response.data;

      if (data.detail) {
        setApplyError(data.detail);
      } else if (data.job) {
        setApplyError(
          Array.isArray(data.job)
            ? data.job[0]
            : data.job
        );
      } else {
        setApplyError(
          "Unable to submit application."
        );
      }
    } else {
      setApplyError(
        "Could not reach the backend server."
      );
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
              onClick={() => navigate("/")}
            >
              ← Back to Jobs
            </button>

            <div className="job-details-header">
              <div className="company-logo large">
                {job.company?.charAt(0)?.toUpperCase() || "J"}
              </div>

              <div>
                <h1>{job.title}</h1>
                <p className="company-name">
                  {job.company}
                </p>
              </div>
            </div>

            <div className="job-details-info">
              {job.location && (
                <span>📍 {job.location}</span>
              )}

              {job.job_type && (
                <span>
                  💼 {formatJobType(job.job_type)}
                </span>
              )}

              {job.experience && (
                <span>
                  🧑‍💻 {job.experience}
                </span>
              )}
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
  className="apply-button"
  onClick={handleApply}
  disabled={applying}
>
  {applying ? "Submitting..." : "Apply Now"}
</button>
          </section>
        )}
      </main>
    </>
  );
}

export default JobDetails;