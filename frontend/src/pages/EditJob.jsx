
import { useEffect, useState } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function EditJob() {
  const navigate = useNavigate();
  const { id } = useParams();

  const token = localStorage.getItem("access_token");
  const user = JSON.parse(
    localStorage.getItem("user") || "null"
  );

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    company: "",
    location: "",
    salary: "",
    job_type: "full_time",
    experience: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || user?.role !== "recruiter") {
      return;
    }

    api
      .get(`/jobs/${id}/`)
      .then((response) => {
        const job = response.data;

        // Security check on the frontend.
        // Backend also protects update/delete.
        if (job.recruiter !== user.username) {
          setError(
            "You can only edit your own jobs."
          );
          return;
        }

        setFormData({
          title: job.title || "",
          description: job.description || "",
          company: job.company || "",
          location: job.location || "",
          salary: job.salary || "",
          job_type: job.job_type || "full_time",
          experience: job.experience || "",
        });
      })
      .catch((error) => {
        console.error("Load job error:", error);

        if (error.response) {
          setError(
            error.response.data?.detail ||
              `Unable to load job (${error.response.status})`
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
  }, [id, token, user?.username, user?.role]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "recruiter") {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSaving(true);

    try {
      const data = {
        ...formData,
        salary:
          formData.salary === ""
            ? null
            : formData.salary,
      };

      const response = await api.patch(
        `/jobs/${id}/`,
        data
      );

      console.log("Job updated:", response.data);

      navigate("/recruiter");
    } catch (error) {
      console.error("Update job error:", error);

      if (error.response?.data) {
        const errors = error.response.data;

        const messages = Object.entries(errors)
          .map(
            ([field, message]) =>
              `${field}: ${message}`
          )
          .join(" ");

        setError(
          messages || "Unable to update job."
        );
      } else {
        setError(
          "Could not connect to the backend server."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="create-job-page">
          <div className="create-job-container">
            <div className="status-message">
              Loading job...
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="create-job-page">
        <div className="create-job-container">

          <div className="create-job-header">
            <h1>Edit Job</h1>
            <p>
              Update the details of your job posting.
            </p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {!error && (
            <form
              onSubmit={handleSubmit}
              className="job-form"
            >

              <div className="form-group">
                <label>Job Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Salary (per month)</label>
                <input
                  type="number"
                  name="salary"
                  value={formData.salary}
                  onChange={handleChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Job Type</label>

                <select
                  name="job_type"
                  value={formData.job_type}
                  onChange={handleChange}
                >
                  <option value="full_time">
                    Full Time
                  </option>

                  <option value="part_time">
                    Part Time
                  </option>

                  <option value="contract">
                    Contract
                  </option>

                  <option value="internship">
                    Internship
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>Experience</label>

                <input
                  type="text"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  placeholder="e.g. 1-2 years"
                />
              </div>

              <div className="form-group">
                <label>Job Description</label>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="7"
                  required
                />
              </div>

              <div className="job-form-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    navigate("/recruiter")
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="create-job-submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </form>
          )}

        </div>
      </main>
    </>
  );
}

export default EditJob;

