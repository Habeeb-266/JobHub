from django.conf import settings
from django.db import models


class ResumeProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resume_profile",
    )
    resume_file = models.FileField(
        upload_to="resumes/",
        null=True,
        blank=True,
    )
    raw_text = models.TextField(blank=True)
    full_name = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    skills = models.JSONField(default=list)
    experience_years = models.FloatField(default=0.0)
    education = models.JSONField(default=list)
    work_history = models.JSONField(default=list)
    summary = models.TextField(blank=True)
    vector_id = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ResumeProfile: {self.full_name or self.user.username} ({len(self.skills)} skills)"
