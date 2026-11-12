import os
from rest_framework import serializers
from .models import Application, ATSResult, ApplicationStatusHistory


class ATSResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ATSResult
        fields = [
            "id",
            "overall_score",
            "matched_skills",
            "missing_skills",
            "relevant_keywords",
            "score_breakdown",
            "extraction_status",
            "extraction_error",
            "screened_at",
        ]


class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.ReadOnlyField(source="changed_by.username")

    class Meta:
        model = ApplicationStatusHistory
        fields = [
            "id",
            "previous_status",
            "new_status",
            "changed_by_username",
            "changed_at",
            "notes",
            "candidate_feedback",
        ]


class ApplicationSerializer(serializers.ModelSerializer):
    candidate = serializers.ReadOnlyField(source="candidate.username")
    candidate_email = serializers.ReadOnlyField(source="candidate.email")
    job_title = serializers.ReadOnlyField(source="job.title")
    company = serializers.ReadOnlyField(source="job.company")
    resume_filename = serializers.SerializerMethodField()
    resume_url = serializers.SerializerMethodField()
    ats_result = ATSResultSerializer(read_only=True)
    status_history = ApplicationStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = [
            "id",
            "candidate",
            "candidate_email",
            "job",
            "job_title",
            "company",
            "status",
            "resume_file",
            "resume_filename",
            "resume_url",
            "ats_result",
            "status_history",
            "internal_notes",
            "candidate_feedback",
            "applied_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "candidate",
            "candidate_email",
            "job_title",
            "company",
            "resume_filename",
            "resume_url",
            "ats_result",
            "status_history",
            "applied_at",
            "updated_at",
        ]

    def get_resume_filename(self, obj):
        if obj.resume_file and obj.resume_file.name:
            return os.path.basename(obj.resume_file.name)
        # Check if candidate has profile resume
        try:
            if hasattr(obj.candidate, "resume_profile") and obj.candidate.resume_profile.resume_file:
                return os.path.basename(obj.candidate.resume_profile.resume_file.name)
        except Exception:
            pass
        return None

    def get_resume_url(self, obj):
        if obj.resume_file or (hasattr(obj.candidate, "resume_profile") and obj.candidate.resume_profile.resume_file):
            return f"/api/applications/{obj.id}/resume/"
        return None

    def validate_status(self, value):
        valid_statuses = dict(Application.STATUS_CHOICES)
        if value not in valid_statuses:
            raise serializers.ValidationError(
                f"Invalid application status: '{value}'. Valid choices: {list(valid_statuses.keys())}"
            )
        return value

    def validate_resume_file(self, value):
        if not value:
            return value

        file_name = value.name.lower()
        if not (file_name.endswith(".pdf") or file_name.endswith(".docx")):
            raise serializers.ValidationError(
                "Unsupported file format. Please upload a PDF or DOCX file."
            )

        if value.size > 10 * 1024 * 1024:  # 10MB
            raise serializers.ValidationError(
                "File size exceeds the 10MB limit."
            )

        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        # If candidate is viewing, ensure internal recruiter notes are never exposed
        if request and getattr(request.user, "role", None) == "candidate":
            data.pop("internal_notes", None)
            # Also clean notes from status history
            if "status_history" in data and isinstance(data["status_history"], list):
                for item in data["status_history"]:
                    item.pop("notes", None)
        return data
