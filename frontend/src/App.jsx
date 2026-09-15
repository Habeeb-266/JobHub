import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import EditJob from "./pages/EditJob";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import CreateJob from "./pages/CreateJob";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import JobDetails from "./pages/JobDetails";
import Applications from "./pages/Applications";
import Profile from "./pages/Profile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />
        <Route
  path="/recruiter/jobs/:id/edit"
  element={<EditJob />}
/>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/jobs/:id"
          element={<JobDetails />}
        />

        <Route
          path="/applications"
          element={<Applications />}
        />

        <Route
          path="/profile"
          element={<Profile />}
        />

        <Route
          path="/recruiter"
          element={<RecruiterDashboard />}
        />

        <Route
          path="/recruiter/jobs/create"
          element={<CreateJob />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;