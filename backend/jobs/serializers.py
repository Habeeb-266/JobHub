from rest_framework import serializers

from .models import Job


class JobSerializer(serializers.ModelSerializer):
    recruiter = serializers.ReadOnlyField(source="recruiter.username")

    class Meta:
        model = Job
        fields = [
            "id",
            "title",
            "description",
            "company",
            "location",
            "salary",
            "job_type",
            "experience",
            "recruiter",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "recruiter",
            "created_at",
            "updated_at",
        ]

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Job title cannot be empty."
            )

        return value

    def validate_description(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Job description cannot be empty."
            )

        return value

    def validate_company(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Company name cannot be empty."
            )

        return value

    def validate_location(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Location cannot be empty."
            )

        return value

    def validate_salary(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "Salary cannot be negative."
            )

        return value