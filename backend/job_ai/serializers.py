from rest_framework import serializers
from .models import ResumeProfile


class ResumeProfileSerializer(serializers.ModelSerializer):
    resume_file_url = serializers.SerializerMethodField()

    class Meta:
        model = ResumeProfile
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "skills",
            "experience_years",
            "education",
            "work_history",
            "summary",
            "resume_file",
            "resume_file_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "resume_file_url", "created_at", "updated_at"]

    def get_resume_file_url(self, obj):
        if obj.resume_file:
            return obj.resume_file.url
        return None
