import os
import re
import zipfile
import xml.etree.ElementTree as ET
from io import BytesIO
from typing import Dict, Any, List, Tuple
from pypdf import PdfReader

from job_ai.services.pdf_parser import (
    TECH_SKILLS_TAXONOMY,
    extract_skills,
    extract_experience_years,
)
from applications.models import ATSResult, Application


# Standard stopwords to exclude from keyword extraction
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "did", "do", "does", "doing", "don't", "down", "during", "each", "few", "for",
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers",
    "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is",
    "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no",
    "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
    "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some",
    "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then",
    "there", "these", "they", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "we", "were", "what", "when", "where", "which",
    "while", "who", "whom", "why", "with", "would", "you", "your", "yours", "yourself",
    "yourselves", "will", "shall", "must", "work", "job", "candidate", "role", "team",
    "years", "year", "experience", "looking", "responsibilities", "requirements",
}

EDUCATION_KEYWORDS = [
    "bachelor", "master", "phd", "doctorate", "degree", "b.tech", "m.tech",
    "b.e", "m.e", "b.sc", "m.sc", "bca", "mca", "diploma", "computer science",
    "information technology", "engineering", "graduated", "university", "college",
]


def extract_text_from_pdf_stream(stream) -> Tuple[str, str]:
    """
    Extracts text from a PDF stream using pypdf.
    Returns (extracted_text, status) where status is 'success' or 'scanned_pdf'.
    """
    try:
        reader = PdfReader(stream)
        if len(reader.pages) == 0:
            return "", "failed"

        extracted_pages = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                extracted_pages.append(page_text.strip())

        full_text = "\n\n".join(extracted_pages).strip()
        if not full_text:
            # Document has pages but no readable text - scanned PDF or rasterized image
            return "", "scanned_pdf"

        return full_text, "success"
    except Exception as exc:
        raise ValueError(f"Failed to read PDF: {str(exc)}")


def extract_text_from_docx_stream(stream) -> Tuple[str, str]:
    """
    Extracts text from a DOCX stream using stdlib zipfile and XML parsing.
    Returns (extracted_text, status).
    """
    try:
        with zipfile.ZipFile(stream) as z:
            if "word/document.xml" not in z.namelist():
                return "", "failed"
            xml_content = z.read("word/document.xml")

        tree = ET.fromstring(xml_content)
        paragraphs = []
        for node in tree.iter():
            if node.tag.endswith("}p"):
                texts = [
                    child.text for child in node.iter()
                    if child.tag.endswith("}t") and child.text
                ]
                if texts:
                    paragraphs.append("".join(texts).strip())

        full_text = "\n".join([p for p in paragraphs if p]).strip()
        if not full_text:
            return "", "failed"

        return full_text, "success"
    except Exception as exc:
        raise ValueError(f"Failed to read DOCX: {str(exc)}")


def extract_text_from_resume_file(file_field) -> Tuple[str, str, str]:
    """
    Extracts text cleanly from a Django FileField or file object.
    Returns (extracted_text, extraction_status, error_message).
    """
    if not file_field:
        return "", "failed", "No resume file provided."

    file_name = getattr(file_field, "name", "").lower()

    try:
        # Seek to beginning if possible
        if hasattr(file_field, "seek"):
            file_field.seek(0)
            content_bytes = file_field.read()
            stream = BytesIO(content_bytes)
        else:
            with open(file_field.path, "rb") as f:
                stream = BytesIO(f.read())

        if file_name.endswith(".pdf") or file_name.endswith(".pdf/"):
            text, status = extract_text_from_pdf_stream(stream)
            if status == "scanned_pdf":
                return "", "scanned_pdf", "Scanned PDF detected. No extractable text found."
            return text, "success", ""

        elif file_name.endswith(".docx"):
            text, status = extract_text_from_docx_stream(stream)
            if status != "success" or not text:
                return "", "failed", "Empty or unreadable DOCX document."
            return text, "success", ""

        else:
            # Fallback attempt: try PDF first, then DOCX
            try:
                stream.seek(0)
                text, status = extract_text_from_pdf_stream(stream)
                if text:
                    return text, "success", ""
            except Exception:
                pass

            try:
                stream.seek(0)
                text, status = extract_text_from_docx_stream(stream)
                if text:
                    return text, "success", ""
            except Exception:
                pass

            return "", "failed", f"Unsupported file format: {file_name}"

    except Exception as exc:
        return "", "failed", str(exc)


def extract_job_keywords(job) -> List[str]:
    """
    Extracts relevant keywords from job title and description.
    """
    combined_text = f"{job.title} {job.description} {job.experience}".lower()
    # Normalize punctuation and tokenize
    tokens = re.findall(r"[a-zA-Z0-9#+.]+", combined_text)

    meaningful = []
    seen = set()
    for token in tokens:
        cleaned = token.strip(".,;:()")
        if (
            len(cleaned) >= 3
            and cleaned not in STOPWORDS
            and not cleaned.isdigit()
            and cleaned not in seen
        ):
            seen.add(cleaned)
            meaningful.append(cleaned)

    return meaningful[:40]


def run_ats_screening(application: Application) -> ATSResult:
    """
    Executes ATS screening on an application's resume against the applied job.
    Calculates a transparent weighted match score (0 - 100):
      - Required skills match: 50%
      - Relevant keywords match: 25%
      - Experience match: 15%
      - Education & qualifications match: 10%
    Saves and returns the ATSResult instance.
    """
    resume_file = application.resume_file

    # Fallback to candidate's ResumeProfile resume if application file is empty
    if not resume_file:
        try:
            profile = application.candidate.resume_profile
            if profile and profile.resume_file:
                resume_file = profile.resume_file
        except Exception:
            resume_file = None

    if not resume_file:
        ats_result, _ = ATSResult.objects.update_or_create(
            application=application,
            defaults={
                "overall_score": 0.0,
                "matched_skills": [],
                "missing_skills": [],
                "relevant_keywords": [],
                "score_breakdown": {
                    "skills_score": 0.0,
                    "keywords_score": 0.0,
                    "experience_score": 0.0,
                    "education_score": 0.0,
                },
                "extraction_status": "failed",
                "extraction_error": "No resume file available to screen.",
            },
        )
        return ats_result

    # 1. Text extraction
    resume_text, status, error_msg = extract_text_from_resume_file(resume_file)

    if status != "success" or not resume_text.strip():
        status_label = "scanned_pdf" if status == "scanned_pdf" else "failed"
        ats_result, _ = ATSResult.objects.update_or_create(
            application=application,
            defaults={
                "overall_score": 0.0,
                "matched_skills": [],
                "missing_skills": [],
                "relevant_keywords": [],
                "score_breakdown": {
                    "skills_score": 0.0,
                    "keywords_score": 0.0,
                    "experience_score": 0.0,
                    "education_score": 0.0,
                },
                "extraction_status": status_label,
                "extraction_error": (
                    "Resume is a scanned document without selectable text. Manual review recommended."
                    if status == "scanned_pdf"
                    else (error_msg or "Failed to extract text from resume.")
                ),
            },
        )
        return ats_result

    # 2. Extract skills from Job and Resume
    job = application.job
    job_content = f"{job.title}\n{job.description}\n{job.experience}"
    job_skills = extract_skills(job_content)
    resume_skills = extract_skills(resume_text)

    # If job has no formal taxonomy skills, identify any mentioned skills or tokens
    if not job_skills:
        # Fallback: check if any tech keywords appear in job description
        for key, canonical in TECH_SKILLS_TAXONOMY.items():
            if re.search(rf"\b{re.escape(key)}\b", job_content.lower()):
                if canonical not in job_skills:
                    job_skills.append(canonical)

    matched_skills = [s for s in job_skills if s in resume_skills]
    missing_skills = [s for s in job_skills if s not in resume_skills]

    # Required skills score (50%)
    if job_skills:
        skills_ratio = len(matched_skills) / len(job_skills)
    else:
        # If no specific skills required by job, give full skill score if candidate has any skills
        skills_ratio = 1.0 if len(resume_skills) > 0 else 0.5
    skills_score = round(skills_ratio * 50.0, 1)

    # 3. Relevant keywords matching (25%)
    job_keywords = extract_job_keywords(job)
    resume_text_lower = resume_text.lower()
    matched_keywords = [
        kw for kw in job_keywords
        if re.search(rf"\b{re.escape(kw)}\b", resume_text_lower)
    ]
    if job_keywords:
        keyword_ratio = len(matched_keywords) / len(job_keywords)
    else:
        keyword_ratio = 1.0
    keywords_score = round(min(keyword_ratio, 1.0) * 25.0, 1)

    # 4. Job-related experience matching (15%)
    # Extract years required from job
    job_exp_years = extract_experience_years(f"{job.experience} {job.description}")
    resume_exp_years = extract_experience_years(resume_text)

    if job_exp_years > 0:
        if resume_exp_years >= job_exp_years:
            exp_ratio = 1.0
        elif resume_exp_years > 0:
            exp_ratio = resume_exp_years / job_exp_years
        else:
            exp_ratio = 0.4
    else:
        # Job didn't specify numeric experience; reward candidate having experience
        exp_ratio = 1.0 if resume_exp_years > 0 else 0.7
    experience_score = round(min(exp_ratio, 1.0) * 15.0, 1)

    # 5. Education & qualifications matching (10%)
    has_education = any(
        re.search(rf"\b{re.escape(edu)}\b", resume_text_lower)
        for edu in EDUCATION_KEYWORDS
    )
    education_score = 10.0 if has_education else 4.0

    # Total overall ATS score (0 - 100)
    total_score = round(skills_score + keywords_score + experience_score + education_score, 1)
    total_score = min(max(total_score, 0.0), 100.0)

    score_breakdown = {
        "skills_score": skills_score,
        "max_skills_score": 50.0,
        "keywords_score": keywords_score,
        "max_keywords_score": 25.0,
        "experience_score": experience_score,
        "max_experience_score": 15.0,
        "education_score": education_score,
        "max_education_score": 10.0,
        "candidate_experience_years": resume_exp_years,
        "job_experience_required": job_exp_years,
    }

    ats_result, _ = ATSResult.objects.update_or_create(
        application=application,
        defaults={
            "overall_score": total_score,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "relevant_keywords": matched_keywords[:20],
            "score_breakdown": score_breakdown,
            "extraction_status": "success",
            "extraction_error": "",
        },
    )

    return ats_result
