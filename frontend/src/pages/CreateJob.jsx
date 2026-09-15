import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";

function CreateJob() {
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    company: "",
    location: "",
    salary: "",
    job_type: "full_time",
    experience: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const data = {
        ...formData,
        salary: formData.salary === "" ? null : formData.salary,
      };

      const response = await api.post("/jobs/", data);

      console.log("Job created:", response.data);

      navigate("/recruiter");
    } catch (error) {
      console.error("Create job error:", error);

      if (error.response?.data) {
        const errors = error.response.data;

        const messages = Object.entries(errors)
          .map(([field, message]) => `${field}: ${message}`)
          .join(" ");

        setError(messages || "Unable to create job.");
      } else {
        setError("Could not connect to the backend server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="create-job-page">
        <div className="create-job-container">

          <div className="create-job-header">
            <h1>Create New Job</h1>
            <p>Post a new job opportunity for candidates.</p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="job-form">

            <div className="form-group">
              <label>Job Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Python Developer"
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
                placeholder="e.g. JobHub Technologies"
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
                placeholder="e.g. Kochi, Kerala"
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
                placeholder="e.g. 50000"
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
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
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
                placeholder="Describe the job, responsibilities, requirements, and skills..."
                rows="7"
                required
              />
            </div>

            <div className="job-form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => navigate("/recruiter")}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="create-job-submit"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Job"}
              </button>
            </div>

          </form>
        </div>
      </main>
    </>
  );
}

export default CreateJob;