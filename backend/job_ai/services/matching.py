from sentence_transformers import SentenceTransformer


model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


def build_job_text(job):
    return f"""
    Job Title: {job.title}

    Description:
    {job.description}

    Company:
    {job.company}

    Location:
    {job.location}

    Job Type:
    {job.job_type}

    Experience:
    {job.experience}
    """


def match_jobs(candidate_text, jobs):

    if not jobs:
        return []

    job_objects = list(jobs)

    job_texts = [
        build_job_text(job)
        for job in job_objects
    ]

    candidate_embedding = model.encode(
        candidate_text,
        normalize_embeddings=True,
    )

    job_embeddings = model.encode(
        job_texts,
        normalize_embeddings=True,
    )

    scores = job_embeddings @ candidate_embedding

    results = []

    for job, score in zip(job_objects, scores):

        percentage = round(
            float(score) * 100,
            2,
        )

        results.append(
            {
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "job_type": job.job_type,
                "experience": job.experience,
                "match_score": percentage,
            }
        )

    results.sort(
        key=lambda item: item["match_score"],
        reverse=True,
    )

    return results[:10]