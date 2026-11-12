import re
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from jobs.models import Job
from .models import ResumeProfile
from .serializers import ResumeProfileSerializer
from .services.pdf_parser import parse_resume_content
from .services.vector_store import (
    index_resume,
    vector_search_jobs,
    vector_search_candidates,
    sync_all_jobs_to_index,
    build_resume_vector_text,
    build_job_vector_text,
)


class ResumeUploadView(APIView):
    """
    Ingests PDF resume, extracts unstructured text to structured schema,
    persists candidate profile and indexes dense vector into ChromaDB.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get("resume")
        if not file_obj:
            return Response(
                {"error": "Please select a resume file (.pdf) to upload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not file_obj.name.lower().endswith(".pdf"):
            return Response(
                {"error": "Unsupported file format. Please upload a PDF file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_obj.size > 10 * 1024 * 1024:  # 10MB limit
            return Response(
                {"error": "File size exceeds the 10MB limit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # 1. Execute ETL Pipeline (Extract -> Clean -> Schema Validation)
            parsed_data = parse_resume_content(file_obj)

            # Rewind file pointer after reading so Django can save it
            file_obj.seek(0)

            # 2. Persist to Relational Database (ResumeProfile)
            profile, created = ResumeProfile.objects.get_or_create(
                user=request.user,
                defaults={"resume_file": file_obj},
            )

            profile.resume_file = file_obj
            profile.full_name = parsed_data.contact_info.name or request.user.username
            profile.email = parsed_data.contact_info.email or request.user.email
            profile.phone = parsed_data.contact_info.phone or ""
            profile.skills = parsed_data.skills
            profile.experience_years = parsed_data.experience_years
            profile.summary = parsed_data.summary
            profile.save()

            # 3. Vector Database Ingestion (ChromaDB)
            vector_id = index_resume(profile)
            profile.vector_id = vector_id
            profile.save(update_fields=["vector_id"])

            serializer = ResumeProfileSerializer(profile)
            return Response(
                {
                    "message": "Resume successfully parsed and indexed in vector database!",
                    "profile": serializer.data,
                    "extracted_stats": {
                        "skills_found": len(parsed_data.skills),
                        "experience_years": parsed_data.experience_years,
                        "has_contact_info": bool(parsed_data.contact_info.email or parsed_data.contact_info.phone),
                    },
                },
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )
        except Exception as exc:
            return Response(
                {"error": f"Failed to parse resume: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CandidateResumeProfileView(APIView):
    """
    Retrieve or update candidate's parsed resume profile and re-index vector.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.resume_profile
            serializer = ResumeProfileSerializer(profile)
            return Response({"has_resume": True, "profile": serializer.data}, status=status.HTTP_200_OK)
        except ResumeProfile.DoesNotExist:
            return Response({"has_resume": False, "profile": None}, status=status.HTTP_200_OK)

    def patch(self, request):
        try:
            profile = request.user.resume_profile
        except ResumeProfile.DoesNotExist:
            return Response({"error": "No resume profile found to update."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ResumeProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Update Vector Index with revised skills/summary
            index_resume(profile)
            return Response(
                {"message": "Profile updated and re-indexed successfully.", "profile": serializer.data},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResumeJobMatchView(APIView):
    """
    Sub-second Vector Search: Matches candidate's resume embedding against indexed jobs in ChromaDB.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.resume_profile
        except ResumeProfile.DoesNotExist:
            return Response(
                {"error": "Please upload your resume in Profile to enable AI matching."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ensure jobs are synced into ChromaDB
        sync_all_jobs_to_index(Job.objects.all())

        # Construct vector search query from candidate profile
        query_text = build_resume_vector_text(profile)

        # Filters from query parameters
        job_type = request.query_params.get("job_type", None)
        location = request.query_params.get("location", None)

        raw_matches = vector_search_jobs(
            query_text=query_text,
            top_k=15,
            job_type=job_type,
            location=location,
        )

        candidate_skills_lower = {s.lower() for s in profile.skills}

        # Calculate matched skills for each returned job
        for item in raw_matches:
            try:
                job_obj = Job.objects.get(id=item["job_id"])
                desc_lower = job_obj.description.lower()
                overlapping = [
                    s for s in profile.skills
                    if re.search(rf"\b{re.escape(s.lower())}\b", desc_lower)
                ]
                item["matched_skills"] = overlapping
            except Job.DoesNotExist:
                item["matched_skills"] = []

        return Response(
            {
                "candidate_name": profile.full_name or request.user.username,
                "skills_count": len(profile.skills),
                "skills": profile.skills,
                "matches": raw_matches,
            },
            status=status.HTTP_200_OK,
        )


class JobCandidateMatchView(APIView):
    """
    Recruiter Talent Search: Find top matching candidates from ChromaDB for a specific job posting.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        job_text = build_job_vector_text(job)
        matches = vector_search_candidates(job_text=job_text, top_k=10)

        return Response(
            {
                "job_id": job.id,
                "job_title": job.title,
                "candidate_matches": matches,
            },
            status=status.HTTP_200_OK,
        )


class AIJobMatchView(APIView):
    """
    Legacy/Direct skills text matcher powered by ChromaDB vector search.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        skills = request.data.get("skills", "")
        if not skills.strip():
            return Response(
                {"error": "Please provide your skills."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sync_all_jobs_to_index(Job.objects.all())
        results = vector_search_jobs(query_text=skills, top_k=10)

        return Response(
            {
                "candidate_profile": skills,
                "matches": results,
            },
            status=status.HTTP_200_OK,
        )