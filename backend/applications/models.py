from django.conf import settings
from django.db import models


class Application(models.Model):

    STATUS_CHOICES = (
        ("applied", "Applied"),
        ("under_review", "Under Review"),
        ("shortlisted", "Shortlisted"),
        ("interview_scheduled", "Interview Scheduled"),
        ("selected", "Selected"),
        ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
        # Legacy status support for backward compatibility:
        ("pending", "Pending"),
        ("hired", "Hired"),
    )

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications",
    )

    job = models.ForeignKey(
        "jobs.Job",
        on_delete=models.CASCADE,
        related_name="applications",
    )

    resume_file = models.FileField(
        upload_to="resumes/",
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="applied",
    )

    internal_notes = models.TextField(blank=True)
    candidate_feedback = models.TextField(blank=True)

    applied_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-applied_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["candidate", "job"],
                name="unique_candidate_job_application",
            )
        ]

    def __str__(self):
        return f"{self.candidate.username} - {self.job.title} ({self.status})"


class ATSResult(models.Model):
    application = models.OneToOneField(
        Application,
        on_delete=models.CASCADE,
        related_name="ats_result",
    )
    overall_score = models.FloatField(default=0.0)
    matched_skills = models.JSONField(default=list)
    missing_skills = models.JSONField(default=list)
    relevant_keywords = models.JSONField(default=list)
    score_breakdown = models.JSONField(default=dict)
    extraction_status = models.CharField(max_length=50, default="pending")  # success, failed, scanned_pdf
    extraction_error = models.TextField(blank=True)
    screened_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ATS Result: App #{self.application_id} - Score: {self.overall_score}%"


class ApplicationStatusHistory(models.Model):
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    previous_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="status_changes",
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    candidate_feedback = models.TextField(blank=True)

    class Meta:
        ordering = ["-changed_at"]

    def __str__(self):
        return f"App #{self.application_id}: {self.previous_status} -> {self.new_status}"
