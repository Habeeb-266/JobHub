import re
from typing import Dict, Any, List, Tuple
from pypdf import PdfReader

from .schemas import ParsedResumeSchema, ContactInfoSchema, EducationItemSchema, WorkExperienceItemSchema


# Curated Tech Skills Taxonomy with normalization mappings
TECH_SKILLS_TAXONOMY = {
    # Programming Languages
    "python": "Python",
    "javascript": "JavaScript",
    "js": "JavaScript",
    "typescript": "TypeScript",
    "ts": "TypeScript",
    "java": "Java",
    "c++": "C++",
    "cpp": "C++",
    "c#": "C#",
    "golang": "Go",
    "go": "Go",
    "rust": "Rust",
    "php": "PHP",
    "ruby": "Ruby",
    "swift": "Swift",
    "kotlin": "Kotlin",
    "r": "R",
    "sql": "SQL",
    "html": "HTML5",
    "html5": "HTML5",
    "css": "CSS3",
    "css3": "CSS3",

    # Web & Backend Frameworks
    "django": "Django",
    "django rest framework": "Django REST Framework",
    "drf": "Django REST Framework",
    "fastapi": "FastAPI",
    "flask": "Flask",
    "express": "Express.js",
    "express.js": "Express.js",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "spring": "Spring Boot",
    "spring boot": "Spring Boot",
    "asp.net": "ASP.NET",
    "laravel": "Laravel",
    "ruby on rails": "Ruby on Rails",

    # Frontend Frameworks & Libraries
    "react": "React",
    "react.js": "React",
    "reactjs": "React",
    "next.js": "Next.js",
    "nextjs": "Next.js",
    "vue": "Vue.js",
    "vue.js": "Vue.js",
    "angular": "Angular",
    "tailwind": "Tailwind CSS",
    "tailwind css": "Tailwind CSS",
    "bootstrap": "Bootstrap",
    "redux": "Redux",
    "zustand": "Zustand",
    "vite": "Vite",

    # Databases & Storage
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "mysql": "MySQL",
    "sqlite": "SQLite",
    "mongodb": "MongoDB",
    "redis": "Redis",
    "cassandra": "Cassandra",
    "elasticsearch": "Elasticsearch",
    "dynamodb": "DynamoDB",
    "chromadb": "ChromaDB",
    "vector database": "Vector DB",
    "qdrant": "Qdrant",
    "pinecone": "Pinecone",

    # Data Science, ML & AI
    "pandas": "Pandas",
    "numpy": "NumPy",
    "scipy": "SciPy",
    "scikit-learn": "Scikit-Learn",
    "sklearn": "Scikit-Learn",
    "pytorch": "PyTorch",
    "tensorflow": "TensorFlow",
    "keras": "Keras",
    "xgboost": "XGBoost",
    "matplotlib": "Matplotlib",
    "seaborn": "Seaborn",
    "plotly": "Plotly",
    "powerbi": "Power BI",
    "power bi": "Power BI",
    "tableau": "Tableau",
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "natural language processing": "NLP",
    "nlp": "NLP",
    "computer vision": "Computer Vision",
    "transformers": "Transformers",
    "huggingface": "Hugging Face",
    "llm": "LLMs",
    "large language models": "LLMs",
    "rag": "RAG",
    "langchain": "LangChain",
    "llamaindex": "LlamaIndex",
    "data analysis": "Data Analysis",
    "data engineering": "Data Engineering",
    "etl": "ETL Pipelines",

    # Cloud, DevOps & Tools
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "k8s": "Kubernetes",
    "aws": "AWS",
    "amazon web services": "AWS",
    "azure": "Azure",
    "gcp": "Google Cloud",
    "google cloud": "Google Cloud",
    "git": "Git",
    "github": "GitHub",
    "gitlab": "GitLab",
    "ci/cd": "CI/CD",
    "linux": "Linux",
    "bash": "Bash",
    "rest api": "REST APIs",
    "graphql": "GraphQL",
    "microservices": "Microservices",
    "kafka": "Apache Kafka",
    "spark": "Apache Spark",
    "airflow": "Apache Airflow",
}


def extract_text_from_pdf(pdf_stream_or_path) -> str:
    """
    Extracts text cleanly from a PDF stream, file handle, or path using pypdf.
    """
    try:
        reader = PdfReader(pdf_stream_or_path)
        extracted_pages = []
        for idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                extracted_pages.append(page_text)
        return "\n\n".join(extracted_pages).strip()
    except Exception as exc:
        raise ValueError(f"Failed to read PDF file: {str(exc)}")


def extract_contact_info(text: str) -> ContactInfoSchema:
    """
    Extracts candidate contact information using regex patterns.
    """
    # Email
    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
    email = email_match.group(0).lower() if email_match else ""

    # Phone (handles +1, (123) 456-7890, +91 9876543210, etc.)
    phone_match = re.search(r"(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}", text)
    phone = phone_match.group(0).strip() if phone_match else ""
    # Filter out common false positives like dates or pure numbers < 8 chars
    if len(re.sub(r"\D", "", phone)) < 7:
        phone = ""

    # LinkedIn
    linkedin_match = re.search(r"(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+", text, re.IGNORECASE)
    linkedin = linkedin_match.group(0) if linkedin_match else ""

    # GitHub
    github_match = re.search(r"(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+", text, re.IGNORECASE)
    github = github_match.group(0) if github_match else ""

    # Name heuristic: First non-empty line of the resume that doesn't look like contact/header
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    candidate_name = ""
    for line in lines[:5]:
        if (
            not "@" in line
            and not "http" in line.lower()
            and not "resume" in line.lower()
            and len(line.split()) <= 4
            and len(line) >= 3
        ):
            candidate_name = line
            break

    return ContactInfoSchema(
        name=candidate_name,
        email=email,
        phone=phone,
        linkedin=linkedin,
        github=github,
    )


def extract_skills(text: str) -> List[str]:
    """
    Extracts and standardizes technical skills against our comprehensive taxonomy.
    Uses regex word boundaries to prevent substring false-matches.
    """
    found_skills = []
    seen = set()

    text_lower = text.lower()

    # Sort taxonomy keys by length descending to match multi-word phrases first (e.g. "django rest framework" before "django")
    sorted_patterns = sorted(TECH_SKILLS_TAXONOMY.keys(), key=len, reverse=True)

    for skill_key in sorted_patterns:
        canonical_name = TECH_SKILLS_TAXONOMY[skill_key]
        if canonical_name in seen:
            continue

        # Build regex with word boundaries (handling special chars like ++, #, .js)
        escaped_key = re.escape(skill_key)
        pattern = rf"(?:\b|(?<=\s)){escaped_key}(?:\b|(?=\s)|(?=[,;/.]))"
        if re.search(pattern, text_lower):
            seen.add(canonical_name)
            found_skills.append(canonical_name)

    return sorted(found_skills)


def extract_experience_years(text: str) -> float:
    """
    Estimates total years of experience from explicit statements or year ranges.
    """
    # 1. Look for explicit statement: "5+ years of experience", "3 yrs experience"
    explicit_match = re.findall(
        r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:experience|exp)",
        text,
        re.IGNORECASE,
    )
    if explicit_match:
        try:
            return float(explicit_match[0])
        except ValueError:
            pass

    # 2. Look for year ranges: "2019 - 2024", "2021 - Present"
    current_year = 2026
    year_ranges = re.findall(
        r"\b(20\d{2}|19\d{2})\s*[-–—]\s*(20\d{2}|Present|Current)\b",
        text,
        re.IGNORECASE,
    )

    if year_ranges:
        intervals: List[Tuple[int, int]] = []
        for start_str, end_str in year_ranges:
            start_yr = int(start_str)
            end_yr = current_year if end_str.lower() in ("present", "current") else int(end_str)
            if start_yr <= end_yr:
                intervals.append((start_yr, end_yr))

        if intervals:
            # Merge overlapping intervals
            intervals.sort(key=lambda x: x[0])
            merged = [intervals[0]]
            for current in intervals[1:]:
                prev_start, prev_end = merged[-1]
                if current[0] <= prev_end:
                    merged[-1] = (prev_start, max(prev_end, current[1]))
                else:
                    merged.append(current)

            total_years = sum(end - start for start, end in merged)
            return float(min(total_years, 40))  # Cap at reasonable max

    return 0.0


def extract_summary(text: str) -> str:
    """
    Extracts candidate summary / objective section if present.
    """
    # Look for common header anchors
    pattern = r"(?:summary|objective|profile|about\s*me)\s*[:\n\-](.+?)(?=(?:experience|education|skills|projects|certifications|\Z))"
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if match:
        snippet = match.group(1).strip()
        # Clean excessive newlines
        cleaned = " ".join(line.strip() for line in snippet.splitlines() if line.strip())
        return cleaned[:600]

    # Fallback to first non-contact paragraph
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 60]
    for p in paragraphs:
        if "@" not in p and "http" not in p.lower():
            return " ".join(p.split())[:500]

    return ""


def parse_resume_content(pdf_file) -> ParsedResumeSchema:
    """
    Complete ETL Pipeline:
    PDF File -> Raw Text -> Regex & Taxonomy Entity Extraction -> Pydantic Schema Validation.
    """
    raw_text = extract_text_from_pdf(pdf_file)
    contact_info = extract_contact_info(raw_text)
    skills = extract_skills(raw_text)
    experience_years = extract_experience_years(raw_text)
    summary = extract_summary(raw_text)

    # Enforce Pydantic validation schema
    return ParsedResumeSchema(
        contact_info=contact_info,
        summary=summary,
        skills=skills,
        experience_years=experience_years,
        education=[],
        work_history=[],
    )
