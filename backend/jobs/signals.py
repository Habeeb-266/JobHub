import sys
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Job


@receiver(post_save, sender=Job)
def sync_job_to_vector_index(sender, instance, **kwargs):
    if "test" in sys.argv:
        return
    try:
        from job_ai.services.vector_store import index_job
        index_job(instance)
    except Exception as e:
        print(f"[Vector Index Warning] Failed to index job {instance.id}: {e}")


@receiver(post_delete, sender=Job)
def remove_job_from_vector_index(sender, instance, **kwargs):
    if "test" in sys.argv:
        return
    try:
        from job_ai.services.vector_store import delete_job_from_index
        delete_job_from_index(instance.id)
    except Exception as e:
        print(f"[Vector Index Warning] Failed to delete job {instance.id}: {e}")
