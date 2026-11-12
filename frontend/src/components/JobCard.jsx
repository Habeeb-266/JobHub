import { useNavigate } from "react-router-dom";

function JobCard({ job }) {
  const navigate = useNavigate();

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
    if (!salary) return null;

    const amount = Number(salary);

    if (Number.isNaN(amount)) {
      return salary;
    }

    return `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <article className="job-card">
      <div className="job-card-header">
        <div className="company-logo">
          {job.company?.charAt(0)?.toUpperCase() || "J"}
        </div>

        <div className="job-title-area">
          <h3>{job.title}</h3>
          <p className="company-name">{job.company}</p>
        </div>

        {job.match_score !== undefined && (
          <div className="ai-match-score-badge">
            <span className="sparkle-icon">⚡</span> {job.match_score}% Match
          </div>
        )}
      </div>

      <div className="job-info">
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
        <div className="job-salary">
          {formatSalary(job.salary)}
          <span> / month</span>
        </div>
      )}

      {job.description && (
        <p className="job-description">
          {job.description.length > 120
            ? `${job.description.substring(0, 120)}...`
            : job.description}
        </p>
      )}

      {job.recruiter && (
        <p className="recruiter-name">
          Posted by {job.recruiter}
        </p>
      )}

      {job.matched_skills && job.matched_skills.length > 0 && (
        <div className="matched-skills-preview">
          <span className="matched-label">Matched Skills:</span>
          <div className="matched-tags-wrap">
            {job.matched_skills.map((skill, idx) => (
              <span key={idx} className="matched-tag">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        className="view-job-button"
        onClick={() => navigate(`/jobs/${job.id}`)}
      >
        View Details
      </button>
    </article>
  );
}

export default JobCard;