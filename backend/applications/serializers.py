from rest_framework import serializers
from .models import Application


class ApplicationSerializer(serializers.ModelSerializer):
    candidate = serializers.ReadOnlyField(
        source="candidate.username"
    )

    job_title = serializers.ReadOnlyField(
        source="job.title"
    )

    class Meta:
        model = Application
        fields = [
            "id",
            "candidate",
            "job",
            "job_title",
            "status",
            "applied_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "candidate",
            "job_title",
            "applied_at",
            "updated_at",
        ]

    def validate_status(self, value):
        if value not in dict(Application.STATUS_CHOICES):
            raise serializers.ValidationError(
                "Invalid application status."
            )

        return value