
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function Applications() {
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const token = localStorage.getItem("access_token");

  const user = JSON.parse(
    localStorage.getItem("user") || "null"
  );

  const isRecruiter = user?.role === "recruiter";

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/applications/")
      .then((response) => {
        console.log("Applications:", response.data);

        setApplications(
          response.data.results || response.data
        );
      })
      .catch((error) => {
        console.error("Applications error:", error);

        if (error.response) {
          setError(
            error.response.data?.detail ||
              `Unable to load applications (${error.response.status})`
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
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const formatStatus = (status) => {
    if (!status) return "";

    return (
      status.charAt(0).toUpperCase() +
      status.slice(1)
    );
  };

  const handleStatusChange = (id, newStatus) => {
    setApplications((currentApplications) =>
      currentApplications.map((application) =>
        application.id === id
          ? { ...application, status: newStatus }
          : application
      )
    );
  };

  const updateStatus = async (application) => {
    setUpdatingId(application.id);
    setError("");

    try {
      const response = await api.patch(
        `/applications/${application.id}/`,
        {
          status: application.status,
        }
      );

      console.log(
        "Application status updated:",
        response.data
      );

      setApplications((currentApplications) =>
        currentApplications.map((item) =>
          item.id === application.id
            ? response.data
            : item
        )
      );
    } catch (error) {
      console.error(
        "Update application error:",
        error
      );

      if (error.response) {
        setError(
          error.response.data?.detail ||
            "Unable to update application status."
        );
      } else {
        setError(
          "Could not reach the backend server."
        );
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <Navbar />

      <main className="applications-page">
        <div className="applications-container">

          <div className="applications-header">
            <h1>
              {isRecruiter
                ? "Received Applications"
                : "My Applications"}
            </h1>

            <p>
              {isRecruiter
                ? "Review and manage applications received for your jobs."
                : "Track the jobs you have applied for."}
            </p>
          </div>

          {loading && (
            <div className="status-message">
              Loading applications...
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            applications.length === 0 && (
              <div className="empty-message">
                {isRecruiter ? (
                  <>
                    <h3>No applications received</h3>
                    <p>
                      Candidates haven't applied
                      for your jobs yet.
                    </p>

                    <button
                      className="browse-jobs-button"
                      onClick={() =>
                        navigate("/recruiter")
                      }
                    >
                      Back to Dashboard
                    </button>
                  </>
                ) : (
                  <>
                    <h3>No applications yet</h3>
                    <p>
                      You haven't applied for any
                      jobs yet.
                    </p>

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

          {!loading &&
            !error &&
            applications.length > 0 && (
              <div className="applications-list">

                {applications.map((application) => (
                  <article
                    className="application-card"
                    key={application.id}
                  >

                    <div className="application-main">

                      <h2>
                        {application.job_title}
                      </h2>

                      {isRecruiter && (
                        <p>
                          Candidate:{" "}
                          <strong>
                            {application.candidate}
                          </strong>
                        </p>
                      )}

                      <p>
                        Application ID:{" "}
                        {application.id}
                      </p>

                      <p>
                        Applied on:{" "}
                        {new Date(
                          application.applied_at
                        ).toLocaleDateString(
                          "en-IN"
                        )}
                      </p>

                    </div>

                    <div className="application-side">

                      {isRecruiter ? (
                        <>
                          <select
                            value={application.status}
                            onChange={(e) =>
                              handleStatusChange(
                                application.id,
                                e.target.value
                              )
                            }
                          >
                            <option value="pending">
                              Pending
                            </option>

                            <option value="shortlisted">
                              Shortlisted
                            </option>

                            <option value="rejected">
                              Rejected
                            </option>

                            <option value="hired">
                              Hired
                            </option>
                          </select>

                          <button
                            className="view-application-button"
                            onClick={() =>
                              updateStatus(
                                application
                              )
                            }
                            disabled={
                              updatingId ===
                              application.id
                            }
                          >
                            {updatingId ===
                            application.id
                              ? "Updating..."
                              : "Update Status"}
                          </button>

                          <button
                            className="view-application-button"
                            onClick={() =>
                              navigate(
                                `/jobs/${application.job}`
                              )
                            }
                          >
                            View Job
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className={`status-badge status-${application.status}`}
                          >
                            {formatStatus(
                              application.status
                            )}
                          </span>

                          <button
                            className="view-application-button"
                            onClick={() =>
                              navigate(
                                `/jobs/${application.job}`
                              )
                            }
                          >
                            View Job
                          </button>
                        </>
                      )}

                    </div>

                  </article>
                ))}

              </div>
            )}

        </div>
      </main>
    </>
  );
}

export default Applications;

