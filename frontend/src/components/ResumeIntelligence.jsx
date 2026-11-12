import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function ResumeIntelligence() {
  const navigate = useNavigate();

  const [resumeProfile, setResumeProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [newSkillInput, setNewSkillInput] = useState("");

  // Editable profile state
  const [skills, setSkills] = useState([]);
  const [experienceYears, setExperienceYears] = useState(0);
  const [summary, setSummary] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    fetchResumeProfile();
  }, []);

  const fetchResumeProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ai/resume/me/");
      if (res.data.has_resume && res.data.profile) {
        syncProfileState(res.data.profile);
      }
    } catch (err) {
      console.error("Failed to load resume profile", err);
    } finally {
      setLoading(false);
    }
  };

  const syncProfileState = (data) => {
    setResumeProfile(data);
    setSkills(data.skills || []);
    setExperienceYears(data.experience_years || 0);
    setSummary(data.summary || "");
    setPhone(data.phone || "");
    setFullName(data.full_name || "");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Please upload a PDF file (.pdf).");
      return;
    }

    setUploading(true);
    setErrorMessage("");
    setStatusMessage("Extracting text, running entity extraction & indexing into ChromaDB...");

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const res = await api.post("/ai/resume/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatusMessage("Resume successfully ingested, parsed, and indexed in ChromaDB!");
      syncProfileState(res.data.profile);
    } catch (err) {
      console.error("Resume upload error:", err);
      setErrorMessage(
        err.response?.data?.error || "Failed to process resume. Please try again."
      );
      setStatusMessage("");
    } finally {
      setUploading(false);
    }
  };

  const handleAddSkill = (e) => {
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;

    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills([...skills, trimmed]);
    }
    setNewSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const payload = {
        full_name: fullName,
        phone: phone,
        experience_years: parseFloat(experienceYears) || 0,
        summary: summary,
        skills: skills,
      };

      const res = await api.patch("/ai/resume/me/", payload);
      setStatusMessage("Profile and Vector Index successfully updated!");
      syncProfileState(res.data.profile);
    } catch (err) {
      console.error("Save error:", err);
      setErrorMessage(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="resume-loading">Loading AI Resume Profile...</div>;
  }

  return (
    <div className="resume-intel-card">
      <div className="resume-intel-header">
        <div className="title-with-badge">
          <h2>AI Resume & Vector Profile</h2>
          <span className="ai-tag">ChromaDB Vector Store</span>
        </div>
        <p className="subtitle">
          Upload your PDF resume to automatically extract skills, years of experience, and enable
          sub-second semantic job matching.
        </p>
      </div>

      {statusMessage && <div className="intel-success-banner">{statusMessage}</div>}
      {errorMessage && <div className="intel-error-banner">{errorMessage}</div>}

      {/* Upload Drop Area */}
      <div className="resume-upload-zone">
        <label htmlFor="resume-file-input" className="upload-label">
          <div className="upload-icon">📄</div>
          <span className="upload-primary-text">
            {uploading ? "Extracting & Vectorizing..." : "Click to upload resume (.pdf)"}
          </span>
          <span className="upload-subtext">Max file size 10MB</span>
        </label>
        <input
          id="resume-file-input"
          type="file"
          accept=".pdf"
          disabled={uploading}
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </div>

      {/* Structured Extraction Preview */}
      {resumeProfile && (
        <div className="parsed-results-area">
          <div className="vector-status-pill">
            <span className="pulse-dot"></span>
            Vector Indexed: <strong>{resumeProfile.vector_id || "Active"}</strong>
          </div>

          <div className="form-two-col">
            <div className="field-group">
              <label>Candidate Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
              />
            </div>
            <div className="field-group">
              <label>Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
              />
            </div>
          </div>

          <div className="field-group">
            <label>Estimated Experience (Years)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label>Professional Summary</label>
            <textarea
              rows="3"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Candidate Summary or Bio"
            />
          </div>

          {/* Normalized Skills Tags */}
          <div className="skills-management-section">
            <label className="section-label">
              Parsed Technical Skills ({skills.length})
            </label>
            <div className="skills-chip-container">
              {skills.map((skill, index) => (
                <span key={index} className="skill-chip">
                  {skill}
                  <button
                    type="button"
                    className="chip-remove-btn"
                    onClick={() => handleRemoveSkill(skill)}
                    title="Remove skill"
                  >
                    ×
                  </button>
                </span>
              ))}
              {skills.length === 0 && (
                <span className="no-skills-hint">No skills extracted yet. Add some below.</span>
              )}
            </div>

            <form onSubmit={handleAddSkill} className="add-skill-form">
              <input
                type="text"
                placeholder="Add a new skill (e.g. Docker, PyTorch)..."
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
              />
              <button type="submit" className="add-skill-btn">
                + Add Skill
              </button>
            </form>
          </div>

          {/* Action Row */}
          <div className="intel-actions-row">
            <button
              type="button"
              className="save-intel-btn"
              disabled={saving}
              onClick={handleSaveProfile}
            >
              {saving ? "Updating Vector Index..." : "Save & Re-Index Profile"}
            </button>

            <button
              type="button"
              className="find-matches-btn"
              onClick={() => navigate("/?ai_match=true")}
            >
              🎯 Find Jobs Matching My Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResumeIntelligence;
