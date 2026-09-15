import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    const response = await api.post("/auth/login/", formData);

    console.log("Login response:", response.data);

    localStorage.setItem("access_token", response.data.access);

    if (response.data.refresh) {
      localStorage.setItem("refresh_token", response.data.refresh);
    }

    if (response.data.user) {
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      if (response.data.user.role === "recruiter") {
        navigate("/recruiter");
      } else {
        navigate("/");
      }
    }
  } catch (error) {
    console.error("Login error:", error);

    if (error.response?.data) {
      setError(
        error.response.data.detail ||
        "Invalid username or password"
      );
    } else {
      setError("Unable to connect to the server.");
    }
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>JobHub</h1>
        <h2>Login</h2>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>

            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p>
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;