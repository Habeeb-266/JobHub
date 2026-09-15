
import { useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("user") || "null"
  );

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  const goHome = () => {
    if (user?.role === "recruiter") {
      navigate("/recruiter");
    } else {
      navigate("/");
    }
  };

  return (
    <nav className="navbar">
      <div
        className="navbar-brand"
        onClick={goHome}
      >
        JobHub
      </div>

      <div className="navbar-links">

        {/* Candidate Navigation */}
        {user?.role === "candidate" && (
          <>
            <button onClick={() => navigate("/")}>
              Jobs
            </button>

            <button
              onClick={() => navigate("/applications")}
            >
              Applications
            </button>
          </>
        )}

        {/* Recruiter Navigation */}
        {user?.role === "recruiter" && (
          <>
            <button
              onClick={() => navigate("/recruiter")}
            >
              Dashboard
            </button>

            <button
              onClick={() => navigate("/recruiter")}
            >
              My Jobs
            </button>

            <button
              onClick={() => navigate("/applications")}
            >
              Applications
            </button>
          </>
        )}

        <button
          onClick={() => navigate("/profile")}
        >
          Profile
        </button>

        <span className="navbar-user">
          {user?.username || "User"}
        </span>

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>

      </div>
    </nav>
  );
}

export default Navbar;

