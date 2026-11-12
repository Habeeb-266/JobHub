from django.urls import path
from .views import (
    AIJobMatchView,
    ResumeUploadView,
    CandidateResumeProfileView,
    ResumeJobMatchView,
    JobCandidateMatchView,
)

urlpatterns = [
    path("match/", AIJobMatchView.as_view(), name="ai-job-match"),
    path("resume/upload/", ResumeUploadView.as_view(), name="resume-upload"),
    path("resume/me/", CandidateResumeProfileView.as_view(), name="resume-detail"),
    path("resume/matches/", ResumeJobMatchView.as_view(), name="resume-job-matches"),
    path("jobs/<int:job_id>/candidates/", JobCandidateMatchView.as_view(), name="job-candidate-matches"),
]