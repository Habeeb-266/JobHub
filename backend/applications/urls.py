from django.urls import path
from .views import (
    ApplicationCreateView,
    ApplicationListView,
    ApplicationDetailView,
    ApplicationUpdateView,
    ATSScanView,
    ApplicationResumeDownloadView,
)

urlpatterns = [
    path("", ApplicationListView.as_view(), name="application-list"),
    path("apply/", ApplicationCreateView.as_view(), name="application-create"),
    path("<int:pk>/", ApplicationUpdateView.as_view(), name="application-update"),
    path("<int:pk>/detail/", ApplicationDetailView.as_view(), name="application-detail"),
    path("<int:pk>/scan/", ATSScanView.as_view(), name="application-ats-scan"),
    path("<int:pk>/resume/", ApplicationResumeDownloadView.as_view(), name="application-resume"),
]
