from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Application
from .serializers import ApplicationSerializer


class ApplicationCreateView(generics.CreateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        if self.request.user.role != "candidate":
            raise ValidationError(
                "Only candidates can apply for jobs."
            )

        job = serializer.validated_data["job"]

        if Application.objects.filter(
            candidate=self.request.user,
            job=job,
        ).exists():
            raise ValidationError(
                "You have already applied for this job."
            )

        serializer.save(candidate=self.request.user)


class ApplicationListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.role == "candidate":
            return Application.objects.filter(
                candidate=user
            )

        if user.role == "recruiter":
            return Application.objects.filter(
                job__recruiter=user
            )

        return Application.objects.none()
    
class ApplicationUpdateView(generics.UpdateAPIView):
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        application = self.get_object()

        if self.request.user.role != "recruiter":
            raise PermissionDenied(
                "Only recruiters can update applications."
            )

        if application.job.recruiter != self.request.user:
            raise PermissionDenied(
                "You can only update applications for your own jobs."
            )

        serializer.save()