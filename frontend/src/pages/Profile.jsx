import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function Profile() {
  const [profile, setProfile] = useState(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me/")
      .then((response) => {
        console.log("Profile:", response.data);

        setProfile(response.data);

        setFormData({
          username: response.data.username || "",
          email: response.data.email || "",
        });
      })
      .catch((error) => {
        console.error("Profile error:", error);

        if (error.response) {
          setError(
            error.response.data?.detail ||
              `Unable to load profile (${error.response.status})`
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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.patch(
        "/auth/me/",
        formData
      );

      console.log(
        "Profile updated:",
        response.data
      );

      setProfile(response.data);

      localStorage.setItem(
        "user",
        JSON.stringify(response.data)
      );

      setSuccess(
        "Profile updated successfully!"
      );
    } catch (error) {
      console.error(
        "Profile update error:",
        error.response?.data
      );

      if (error.response?.data) {
        const data = error.response.data;

        if (data.detail) {
          setError(data.detail);
        } else if (data.username) {
          setError(
            Array.isArray(data.username)
              ? data.username[0]
              : data.username
          );
        } else if (data.email) {
          setError(
            Array.isArray(data.email)
              ? data.email[0]
              : data.email
          );
        } else {
          setError(
            "Unable to update profile."
          );
        }
      } else {
        setError(
          "Could not reach the backend server."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="profile-page">
        <div className="profile-container">
          <div className="profile-header">
            <h1>My Profile</h1>
            <p>
              View and update your account information.
            </p>
          </div>

          {loading && (
            <div className="status-message">
              Loading profile...
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {!loading && profile && (
            <div className="profile-card">
              <div className="profile-role">
                <span>Account Type</span>
                <strong>
                  {profile.role === "candidate"
                    ? "Candidate"
                    : "Recruiter"}
                </strong>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="profile-form-group">
                  <label>Username</label>

                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="profile-form-group">
                  <label>Email</label>

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="profile-form-group">
                  <label>Role</label>

                  <input
                    type="text"
                    value={
                      profile.role === "candidate"
                        ? "Candidate"
                        : "Recruiter"
                    }
                    disabled
                  />
                </div>

                {success && (
                  <div className="success-message">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  className="save-profile-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default Profile;