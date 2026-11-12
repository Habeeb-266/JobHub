from pathlib import Path
from typing import List, Dict, Any, Optional
import os

# Base directory for persistent ChromaDB storage
CHROMA_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "chroma_storage"

_client_instance = None
_model_instance = None


def get_embedding_model():
    """
    Lazy-loader singleton for SentenceTransformer.
    Prevents Django from pausing during startup/migrations.
    """
    global _model_instance
    if _model_instance is None:
        from sentence_transformers import SentenceTransformer
        _model_instance = SentenceTransformer("all-MiniLM-L6-v2")
    return _model_instance


def get_chroma_client():
    """
    Initializes and returns a persistent ChromaDB client.
    """
    global _client_instance
    if _client_instance is None:
        import chromadb
        from chromadb.config import Settings

        os.makedirs(CHROMA_DATA_DIR, exist_ok=True)
        _client_instance = chromadb.PersistentClient(
            path=str(CHROMA_DATA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
    return _client_instance


def get_or_create_collection(name: str):
    """
    Returns an existing or new collection configured for cosine similarity.
    """
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


# -------------------------------------------------------------
# Job Indexing & Vector Search
# -------------------------------------------------------------

def build_job_vector_text(job) -> str:
    return (
        f"Title: {job.title}\n"
        f"Company: {job.company}\n"
        f"Location: {job.location}\n"
        f"Job Type: {job.job_type}\n"
        f"Experience Required: {job.experience}\n"
        f"Description:\n{job.description}"
    )


def index_job(job):
    """
    Indexes or updates a single job posting in ChromaDB.
    """
    collection = get_or_create_collection("jobs_index")
    model = get_embedding_model()

    text = build_job_vector_text(job)
    embedding = model.encode(text, normalize_embeddings=True).tolist()

    metadata = {
        "job_id": job.id,
        "title": job.title or "",
        "company": job.company or "",
        "location": job.location or "",
        "job_type": job.job_type or "",
        "experience": job.experience or "",
        "salary": float(job.salary) if job.salary is not None else 0.0,
    }

    collection.upsert(
        ids=[f"job_{job.id}"],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata],
    )


def delete_job_from_index(job_id: int):
    """
    Removes a job posting from the ChromaDB vector index.
    """
    try:
        collection = get_or_create_collection("jobs_index")
        collection.delete(ids=[f"job_{job_id}"])
    except Exception:
        pass


def sync_all_jobs_to_index(jobs_queryset):
    """
    Batch-indexes existing database jobs into ChromaDB.
    """
    collection = get_or_create_collection("jobs_index")
    existing_count = collection.count()

    job_list = list(jobs_queryset)
    if not job_list or existing_count >= len(job_list):
        return

    model = get_embedding_model()
    texts = [build_job_vector_text(j) for j in job_list]
    embeddings = model.encode(texts, normalize_embeddings=True).tolist()

    ids = [f"job_{j.id}" for j in job_list]
    metadatas = [
        {
            "job_id": j.id,
            "title": j.title or "",
            "company": j.company or "",
            "location": j.location or "",
            "job_type": j.job_type or "",
            "experience": j.experience or "",
            "salary": float(j.salary) if j.salary is not None else 0.0,
        }
        for j in job_list
    ]

    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas,
    )


def vector_search_jobs(
    query_text: str,
    top_k: int = 10,
    job_type: Optional[str] = None,
    location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Queries the jobs Chroma collection with hybrid metadata filtering.
    """
    collection = get_or_create_collection("jobs_index")
    if collection.count() == 0:
        return []

    model = get_embedding_model()
    query_embedding = model.encode(query_text, normalize_embeddings=True).tolist()

    # Build hybrid metadata filter
    where_filter = {}
    conditions = []
    if job_type:
        conditions.append({"job_type": job_type})
    if location:
        conditions.append({"location": location})

    if len(conditions) == 1:
        where_filter = conditions[0]
    elif len(conditions) > 1:
        where_filter = {"$and": conditions}
    else:
        where_filter = None

    query_kwargs = {
        "query_embeddings": [query_embedding],
        "n_results": min(top_k, collection.count()),
    }
    if where_filter:
        query_kwargs["where"] = where_filter

    results = collection.query(**query_kwargs)

    formatted_matches = []
    if results and results.get("ids") and len(results["ids"][0]) > 0:
        ids = results["ids"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        for meta, dist in zip(metadatas, distances):
            # For cosine distance, distance = 1 - cosine_similarity
            # Hence, similarity score = 1 - distance
            similarity = round(max(0.0, (1.0 - dist) * 100), 1)
            formatted_matches.append(
                {
                    "job_id": meta.get("job_id"),
                    "title": meta.get("title"),
                    "company": meta.get("company"),
                    "location": meta.get("location"),
                    "job_type": meta.get("job_type"),
                    "experience": meta.get("experience"),
                    "salary": meta.get("salary"),
                    "match_score": similarity,
                }
            )

    return formatted_matches


# -------------------------------------------------------------
# Candidate Resume Indexing & Vector Search
# -------------------------------------------------------------

def build_resume_vector_text(profile) -> str:
    skills_str = ", ".join(profile.skills) if isinstance(profile.skills, list) else str(profile.skills)
    return (
        f"Candidate: {profile.full_name}\n"
        f"Summary: {profile.summary}\n"
        f"Skills: {skills_str}\n"
        f"Years of Experience: {profile.experience_years}"
    )


def index_resume(profile):
    """
    Indexes candidate resume profile into ChromaDB resumes_index.
    """
    collection = get_or_create_collection("resumes_index")
    model = get_embedding_model()

    text = build_resume_vector_text(profile)
    embedding = model.encode(text, normalize_embeddings=True).tolist()

    skills_str = ", ".join(profile.skills) if isinstance(profile.skills, list) else str(profile.skills)
    metadata = {
        "user_id": profile.user.id,
        "username": profile.user.username,
        "full_name": profile.full_name or profile.user.username,
        "experience_years": float(profile.experience_years),
        "skill_count": len(profile.skills) if isinstance(profile.skills, list) else 0,
    }

    doc_id = f"user_{profile.user.id}"
    collection.upsert(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata],
    )
    return doc_id


def vector_search_candidates(
    job_text: str,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """
    Finds the best matching candidates from the vector database for a given job text.
    """
    collection = get_or_create_collection("resumes_index")
    if collection.count() == 0:
        return []

    model = get_embedding_model()
    query_embedding = model.encode(job_text, normalize_embeddings=True).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
    )

    matches = []
    if results and results.get("ids") and len(results["ids"][0]) > 0:
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        for meta, dist in zip(metadatas, distances):
            similarity = round(max(0.0, (1.0 - dist) * 100), 1)
            matches.append(
                {
                    "user_id": meta.get("user_id"),
                    "username": meta.get("username"),
                    "full_name": meta.get("full_name"),
                    "experience_years": meta.get("experience_years"),
                    "skill_count": meta.get("skill_count"),
                    "match_score": similarity,
                }
            )

    return matches
