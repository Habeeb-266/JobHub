from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from .models import Job
from .serializers import JobSerializer
from django.db.models import Q

class IsRecruiter(IsAuthenticated):
    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.user.role == "recruiter"
        )


class JobListCreateView(generics.ListCreateAPIView):
    queryset = Job.objects.all().order_by("-created_at")
    serializer_class = JobSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsRecruiter()]

        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Job.objects.all().order_by("-created_at")

        search = self.request.query_params.get("search")
        location = self.request.query_params.get("location")
        job_type = self.request.query_params.get("job_type")

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(company__icontains=search)
                | Q(location__icontains=search)
            )

        if location:
            queryset = queryset.filter(
                location__icontains=location
            )

        if job_type:
            queryset = queryset.filter(
                job_type=job_type
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(recruiter=self.request.user)

class JobDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Job.objects.all()
    serializer_class = JobSerializer

    def get_permissions(self):
        if self.request.method in ["PATCH", "PUT", "DELETE"]:
            return [IsRecruiter()]

        return [IsAuthenticated()]

    def perform_update(self, serializer):
        if self.get_object().recruiter != self.request.user:
            raise PermissionDenied(
                "You can only update your own jobs."
            )

        serializer.save()

    def perform_destroy(self, instance):
        if instance.recruiter != self.request.user:
            raise PermissionDenied(
                "You can only delete your own jobs."
            )

        instance.delete()