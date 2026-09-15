import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import api from "../services/api";
import JobCard from "../components/JobCard";
import Navbar from "../components/Navbar";

function Home() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Test authenticated user
    api
      .get("/auth/me/")
      .then((response) => {
        console.log("ME SUCCESS:", response.data);
      })
      .catch((error) => {
        console.error(
          "ME ERROR:",
          error.response?.status,
          error.response?.data
        );
      });

    // Load jobs
    api
      .get("/jobs/")
      .then((response) => {
        console.log("Jobs:", response.data);

        setJobs(response.data.results || []);
      })
      .catch((error) => {
        console.error("Jobs API Error:", error);

        if (error.response) {
          setError(
            `Backend responded with ${error.response.status}: ${
              error.response.data?.detail ||
              "Something went wrong"
            }`
          );
        } else {
          setError("Could not reach the backend server.");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Navbar />

      <div className="home-page">
        <section className="hero">
          <h1>Find your next opportunity</h1>

          <p>
            Discover jobs that match your skills and career goals.
          </p>
        </section>

        <section className="jobs-section">
          <div className="section-header">
            <h2>Available Jobs</h2>

            <span>
              {jobs.length}{" "}
              {jobs.length === 1 ? "job" : "jobs"}
            </span>
          </div>

          {loading && (
            <div className="status-message">
              Loading jobs...
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            jobs.length === 0 && (
              <div className="empty-message">
                <h3>No jobs available</h3>
                <p>
                  Check back later for new opportunities.
                </p>
              </div>
            )}

          {!loading &&
            !error &&
            jobs.length > 0 && (
              <div className="jobs-grid">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                  />
                ))}
              </div>
            )}
        </section>
      </div>
    </>
  );
}

export default Home;