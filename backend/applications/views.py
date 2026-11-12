import os
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse

from .models import Application, ATSResult, ApplicationStatusHistory
from .serializers import (
    ApplicationSerializer,
    ATSResultSerializer,
    ApplicationStatusHistorySerializer,
)
from .services.ats_scanner import run_ats_screening


RECRUITER_ALLOWED_TRANSITIONS = {
    "applied": {"under_review", "shortlisted", "rejected"},
    "pending": {"under_review", "shortlisted", "rejected"},
    "under_review": {"shortlisted", "interview_scheduled", "rejected"},
    "shortlisted": {"interview_scheduled", "selected", "hired", "rejected"},
    "interview_scheduled": {"selected", "hired", "shortlisted", "rejected"},
    "selected": {"rejected", "interview_scheduled"},
    "hired": {"rejected"},
    "rejected": {"under_review"},
    "withdrawn": set(),
}

CANDIDATE_WITHDRAWABLE_STATUSES = {
    "applied", "pending", "under_review", "shortlisted", "interview_scheduled"
}


class ApplicationCreateView(generics.CreateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "candidate":
            raise ValidationError("Only candidates can apply for jobs.")

        job = serializer.validated_data["job"]

        if Application.objects.filter(candidate=user, job=job).exists():
            raise ValidationError("You have already applied for this job.")

        # Check for uploaded resume file in FILES
        resume_file = self.request.FILES.get("resume") or self.request.FILES.get("resume_file")

        # If no file uploaded, check candidate's profile resume
        if not resume_file:
            try:
                if hasattr(user, "resume_profile") and user.resume_profile.resume_file:
                    resume_file = user.resume_profile.resume_file
            except Exception:
                resume_file = None

        if not resume_file:
            raise ValidationError({
                "resume": "Please upload a resume (.pdf or .docx) to apply for this job."
            })

        # Validate file format and size
        file_name = resume_file.name.lower()
        if not (file_name.endswith(".pdf") or file_name.endswith(".docx")):
            raise ValidationError({
                "resume": "Unsupported file format. Please upload a PDF or DOCX file."
            })

        if resume_file.size > 10 * 1024 * 1024:
            raise ValidationError({
                "resume": "Resume file size exceeds the 10MB limit."
            })

        application = serializer.save(
            candidate=user,
            resume_file=resume_file,
            status="applied",
        )

        # Log initial application history
        ApplicationStatusHistory.objects.create(
            application=application,
            previous_status="",
            new_status="applied",
            changed_by=user,
            notes="",
            candidate_feedback="Application submitted successfully.",
        )


class ApplicationListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "candidate":
            return Application.objects.filter(candidate=user).select_related(
                "job", "candidate"
            ).prefetch_related("status_history")

        if user.role == "recruiter":
            return Application.objects.filter(job__recruiter=user).select_related(
                "job", "candidate"
            ).prefetch_related("status_history")

        return Application.objects.none()


class ApplicationDetailView(generics.RetrieveAPIView):
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if obj.candidate != user and obj.job.recruiter != user:
            raise PermissionDenied("You do not have permission to view this application.")
        return obj


class ApplicationUpdateView(generics.UpdateAPIView):
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        application = self.get_object()
        user = self.request.user
        old_status = application.status
        new_status = serializer.validated_data.get("status", old_status)
        internal_notes = serializer.validated_data.get("internal_notes", application.internal_notes)
        candidate_feedback = serializer.validated_data.get("candidate_feedback", application.candidate_feedback)

        # 1. Candidate Role Handling
        if user.role == "candidate":
            if application.candidate != user:
                raise PermissionDenied("You can only manage your own applications.")

            if new_status != old_status:
                if new_status != "withdrawn":
                    raise PermissionDenied("Candidates are only permitted to withdraw their application.")

                if old_status not in CANDIDATE_WITHDRAWABLE_STATUSES:
                    raise ValidationError(
                        f"Cannot withdraw an application that is already '{old_status}'."
                    )

            # Candidates cannot modify recruiter internal notes
            serializer.save(
                status=new_status,
                internal_notes=application.internal_notes,
            )

            if old_status != new_status:
                ApplicationStatusHistory.objects.create(
                    application=application,
                    previous_status=old_status,
                    new_status=new_status,
                    changed_by=user,
                    notes="",
                    candidate_feedback="Candidate withdrew this application.",
                )
            return

        # 2. Recruiter Role Handling
        if user.role == "recruiter":
            if application.job.recruiter != user:
                raise PermissionDenied("You can only update applications for your own jobs.")

            # Validate recruiter transition
            if new_status != old_status:
                allowed = RECRUITER_ALLOWED_TRANSITIONS.get(old_status, set())
                if new_status not in allowed:
                    raise ValidationError(
                        f"Invalid transition from '{old_status}' to '{new_status}'. Allowed: {list(allowed)}"
                    )

            instance = serializer.save()

            # Record history if status changed or notes added
            if (
                old_status != new_status
                or internal_notes != application.internal_notes
                or candidate_feedback != application.candidate_feedback
            ):
                ApplicationStatusHistory.objects.create(
                    application=instance,
                    previous_status=old_status,
                    new_status=new_status,
                    changed_by=user,
                    notes=internal_notes,
                    candidate_feedback=candidate_feedback,
                )
            return

        raise PermissionDenied("Unauthorized role.")


class ATSScanView(APIView):
    """
    Triggers ATS resume screening for an application.
    Recruiter-only endpoint.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            application = Application.objects.select_related("job", "candidate").get(pk=pk)
        except Application.DoesNotExist:
            return Response({"error": "Application not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role != "recruiter" or application.job.recruiter != request.user:
            raise PermissionDenied("You can only run ATS screening on applications for your jobs.")

        ats_result = run_ats_screening(application)
        serializer = ATSResultSerializer(ats_result)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def get(self, request, pk):
        try:
            application = Application.objects.select_related("job", "candidate").get(pk=pk)
        except Application.DoesNotExist:
            return Response({"error": "Application not found."}, status=status.HTTP_404_NOT_FOUND)

        if application.candidate != request.user and application.job.recruiter != request.user:
            raise PermissionDenied("You do not have permission to view ATS results for this application.")

        if not hasattr(application, "ats_result"):
            return Response({"error": "ATS screening has not been performed yet."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ATSResultSerializer(application.ats_result)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ApplicationResumeDownloadView(APIView):
    """
    Secure endpoint for viewing and downloading candidate resumes.
    Ensures only the candidate or the job's recruiter can access the file.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            application = Application.objects.select_related("job", "candidate").get(pk=pk)
        except Application.DoesNotExist:
            return Response({"error": "Application not found."}, status=status.HTTP_404_NOT_FOUND)

        if application.candidate != request.user and application.job.recruiter != request.user:
            raise PermissionDenied("You do not have permission to access this resume.")

        resume_file = application.resume_file
        if not resume_file:
            # Fallback to candidate profile resume
            try:
                if hasattr(application.candidate, "resume_profile") and application.candidate.resume_profile.resume_file:
                    resume_file = application.candidate.resume_profile.resume_file
            except Exception:
                pass

        if not resume_file:
            return Response({"error": "No resume file available for this application."}, status=status.HTTP_404_NOT_FOUND)

        try:
            file_handle = resume_file.open("rb")
        except Exception as exc:
            return Response({"error": f"Unable to read resume file: {str(exc)}"}, status=status.HTTP_404_NOT_FOUND)

        file_name = os.path.basename(resume_file.name)
        lower_name = file_name.lower()
        if lower_name.endswith(".pdf"):
            content_type = "application/pdf"
        elif lower_name.endswith(".docx"):
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            content_type = "application/octet-stream"

        as_attachment = request.query_params.get("download") in ["true", "1", "yes"]
        disposition = "attachment" if as_attachment else "inline"

        response = FileResponse(file_handle, content_type=content_type)
        response["Content-Disposition"] = f'{disposition}; filename="{file_name}"'
        return response
