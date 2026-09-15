
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function RecruiterDashboard() {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      </main>
    </>
  );
}

export default RecruiterDashboard;

