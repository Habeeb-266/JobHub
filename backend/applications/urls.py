from django.urls import path

from .views import (
    ApplicationCreateView,
    ApplicationListView,
    ApplicationUpdateView,
)

urlpatterns = [
    path(
        "",
        ApplicationListView.as_view(),
        name="application-list",
    ),
    path(
        "apply/",
        ApplicationCreateView.as_view(),
        name="application-create",
    ),
    
    path(
    "<int:pk>/",
    ApplicationUpdateView.as_view(),
    name="application-update",
),
]