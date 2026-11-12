import io
import zipfile
from pypdf import PdfWriter
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import User
from jobs.models import Job
from applications.models import Application, ATSResult, ApplicationStatusHistory


def create_dummy_pdf(text="John Doe - Python Django React PostgreSQL Docker Developer with 4 years experience"):
    text_bytes = text.encode("utf-8")
    stream_content = b"BT\n/F1 12 Tf\n72 720 Td\n(" + text_bytes + b") Tj\nET\n"
    length = len(stream_content)
    raw = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        b"4 0 obj\n<< /Length " + str(length).encode("ascii") + b" >>\nstream\n"
        + stream_content +
        b"endstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        b"xref\n0 6\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000227 00000 n \n"
        b"0000000363 00000 n \n"
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n436\n%%EOF\n"
    )
    return SimpleUploadedFile("resume.pdf", raw, content_type="application/pdf")



def create_blank_scanned_pdf():
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    return SimpleUploadedFile("scanned.pdf", buf.getvalue(), content_type="application/pdf")


def create_dummy_docx(text="Alice Smith - Python FastAPI Redis Kubernetes Engineer with 5 years experience graduated with bachelor in computer science"):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>{text}</w:t></w:r></w:p>
  </w:body>
</w:document>""")
    return SimpleUploadedFile("resume.docx", buf.getvalue(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


class ATSRecruiterWorkflowTests(APITestCase):
    def setUp(self):
        # Create users
        self.recruiter1 = User.objects.create_user(
            username="recruiter1",
            email="recruiter1@test.com",
            password="Password123!",
            role="recruiter",
        )
        self.recruiter2 = User.objects.create_user(
            username="recruiter2",
            email="recruiter2@test.com",
            password="Password123!",
            role="recruiter",
        )
        self.candidate1 = User.objects.create_user(
            username="candidate1",
            email="candidate1@test.com",
            password="Password123!",
            role="candidate",
        )
        self.candidate2 = User.objects.create_user(
            username="candidate2",
            email="candidate2@test.com",
            password="Password123!",
            role="candidate",
        )

        # Create job owned by recruiter1
        self.job1 = Job.objects.create(
            title="Senior Python Backend Engineer",
            description="We are looking for a Python and Django developer experienced with PostgreSQL, Docker, and React.",
            company="Tech Corp",
            location="Remote",
            salary=120000,
            experience="3+ years",
            recruiter=self.recruiter1,
        )

        # JWT Auth helper
        self.token_candidate1 = str(RefreshToken.for_user(self.candidate1).access_token)
        self.token_candidate2 = str(RefreshToken.for_user(self.candidate2).access_token)
        self.token_recruiter1 = str(RefreshToken.for_user(self.recruiter1).access_token)
        self.token_recruiter2 = str(RefreshToken.for_user(self.recruiter2).access_token)

    def test_01_candidate_applies_with_valid_pdf_resume(self):
        """Scenario 1: Candidate applies for a job with a valid resume."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_candidate1}")
        resume = create_dummy_pdf()

        url = reverse("application-create")
        response = self.client.post(
            url,
            {"job": self.job1.id, "resume": resume},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "applied")
        self.assertEqual(response.data["candidate"], "candidate1")
        self.assertTrue(Application.objects.filter(candidate=self.candidate1, job=self.job1).exists())

        # Check initial status history
        app = Application.objects.get(candidate=self.candidate1, job=self.job1)
        self.assertEqual(app.status_history.count(), 1)
        self.assertEqual(app.status_history.first().new_status, "applied")

    def test_02_recruiter_views_submitted_application(self):
        """Scenario 2: Recruiter views the submitted application."""
        resume = create_dummy_pdf()
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=resume,
            status="applied",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_recruiter1}")
        url = reverse("application-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], app.id)
        self.assertEqual(results[0]["candidate_email"], "candidate1@test.com")

    def test_03_recruiter_and_candidate_open_and_download_resume(self):
        """Scenario 3: Recruiter opens and downloads the resume securely."""
        resume = create_dummy_pdf()
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=resume,
            status="applied",
        )

        # 1. Recruiter views inline
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_recruiter1}")
        url = reverse("application-resume", kwargs={"pk": app.id})
        res_view = self.client.get(url)
        self.assertEqual(res_view.status_code, status.HTTP_200_OK)
        self.assertIn("inline", res_view["Content-Disposition"])

        # 2. Recruiter downloads
        res_download = self.client.get(f"{url}?download=1")
        self.assertEqual(res_download.status_code, status.HTTP_200_OK)
        self.assertIn("attachment", res_download["Content-Disposition"])

        # 3. Candidate views own resume
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_candidate1}")
        res_cand = self.client.get(url)
        self.assertEqual(res_cand.status_code, status.HTTP_200_OK)

    def test_04_ats_extracts_text_from_pdf_and_scores(self):
        """Scenario 4, 6, 7: ATS successfully extracts text from PDF and calculates score."""
        resume = create_dummy_pdf("Expert in Python, Django, PostgreSQL, Docker with 4 years experience in Computer Science")
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=resume,
            status="applied",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_recruiter1}")
        url = reverse("application-ats-scan", kwargs={"pk": app.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["extraction_status"], "success")
        self.assertGreater(response.data["overall_score"], 50.0)
        self.assertIn("Python", response.data["matched_skills"])
        self.assertIn("Django", response.data["matched_skills"])

    def test_05_ats_extracts_text_from_docx_and_scores(self):
        """Scenario 5: ATS successfully extracts text from DOCX resume."""
        docx = create_dummy_docx("Experienced developer with Python, Django, PostgreSQL, and React with 5 years experience")
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=docx,
            status="applied",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_recruiter1}")
        url = reverse("application-ats-scan", kwargs={"pk": app.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["extraction_status"], "success")
        self.assertIn("Python", response.data["matched_skills"])
        self.assertIn("React", response.data["matched_skills"])
        self.assertGreater(response.data["overall_score"], 60.0)

    def test_08_ats_handles_scanned_unreadable_resume(self):
        """Scenario 8: ATS handles scanned PDF without selectable text gracefully."""
        scanned_pdf = create_blank_scanned_pdf()
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=scanned_pdf,
            status="applied",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_recruiter1}")
        url = reverse("application-ats-scan", kwargs={"pk": app.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["extraction_status"], "scanned_pdf")
        self.assertEqual(response.data["overall_score"], 0.0)
        self.assertIn("scanned document", response.data["extraction_error"].lower())

    def test_09_recruiter_updates_application_status_and_validates_transition(self):
        """Scenario 9 & 14: Recruiter updates status and history is recorded."""
        resume = create_dummy_pdf()
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=resume,
            status="applied",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_recruiter1}")
        url = reverse("application-update", kwargs={"pk": app.id})

        # Valid transition: applied -> under_review
        res1 = self.client.patch(
            url,
            {
                "status": "under_review",
                "internal_notes": "Candidate matches strong Python experience.",
                "candidate_feedback": "Your application is currently under review by our team.",
            },
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data["status"], "under_review")

        # Verify history
        app.refresh_from_db()
        self.assertEqual(app.status_history.count(), 1)
        latest_history = app.status_history.first()
        self.assertEqual(latest_history.previous_status, "applied")
        self.assertEqual(latest_history.new_status, "under_review")
        self.assertEqual(latest_history.notes, "Candidate matches strong Python experience.")

        # Invalid transition: under_review cannot jump directly to selected
        res_invalid = self.client.patch(url, {"status": "selected"}, format="json")
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_10_candidate_sees_updated_status_and_public_feedback(self):
        """Scenario 10: Candidate sees updated status and feedback."""
        resume = create_dummy_pdf()
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=resume,
            status="under_review",
            internal_notes="Secret recruiter evaluation: top tier candidate.",
            candidate_feedback="We will reach out next week for a technical chat.",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_candidate1}")
        url = reverse("application-detail", kwargs={"pk": app.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "under_review")
        self.assertEqual(response.data["candidate_feedback"], "We will reach out next week for a technical chat.")

    def test_11_unauthorized_recruiter_cannot_access_other_recruiter_applications(self):
        """Scenario 11: Unauthorized recruiter cannot access or scan another's applications."""
        resume = create_dummy_pdf()
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=resume,
            status="applied",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_recruiter2}")

        # Cannot view application details
        url_detail = reverse("application-detail", kwargs={"pk": app.id})
        res_detail = self.client.get(url_detail)
        self.assertEqual(res_detail.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot download resume
        url_resume = reverse("application-resume", kwargs={"pk": app.id})
        res_resume = self.client.get(url_resume)
        self.assertEqual(res_resume.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot trigger ATS scan
        url_scan = reverse("application-ats-scan", kwargs={"pk": app.id})
        res_scan = self.client.post(url_scan)
        self.assertEqual(res_scan.status_code, status.HTTP_403_FORBIDDEN)

    def test_12_candidate_cannot_set_recruiter_status_but_can_withdraw(self):
        """Scenario 12: Candidate cannot modify recruiter status, but can withdraw."""
        resume = create_dummy_pdf()
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=resume,
            status="applied",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_candidate1}")
        url = reverse("application-update", kwargs={"pk": app.id})

        # Candidate attempts to shortlist self
        res_hack = self.client.patch(url, {"status": "shortlisted"}, format="json")
        self.assertEqual(res_hack.status_code, status.HTTP_403_FORBIDDEN)

        # Candidate withdraws application
        res_withdraw = self.client.patch(url, {"status": "withdrawn"}, format="json")
        self.assertEqual(res_withdraw.status_code, status.HTTP_200_OK)
        app.refresh_from_db()
        self.assertEqual(app.status, "withdrawn")

    def test_13_internal_notes_are_not_visible_to_candidates(self):
        """Scenario 13: Internal notes are strictly private to recruiters."""
        resume = create_dummy_pdf()
        app = Application.objects.create(
            candidate=self.candidate1,
            job=self.job1,
            resume_file=resume,
            status="applied",
            internal_notes="Private Recruiter Note: Check salary expectations.",
            candidate_feedback="Public feedback message.",
        )
        ApplicationStatusHistory.objects.create(
            application=app,
            previous_status="",
            new_status="applied",
            changed_by=self.recruiter1,
            notes="Private recruiter initial thoughts.",
            candidate_feedback="Welcome to JobHub.",
        )

        # 1. Candidate views application
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_candidate1}")
        url = reverse("application-detail", kwargs={"pk": app.id})
        res_cand = self.client.get(url)
        self.assertEqual(res_cand.status_code, status.HTTP_200_OK)
        self.assertNotIn("internal_notes", res_cand.data)
        # Check history item in candidate response does not contain private notes
        self.assertNotIn("notes", res_cand.data["status_history"][0])

        # 2. Recruiter views application
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_recruiter1}")
        res_recruiter = self.client.get(url)
        self.assertEqual(res_recruiter.status_code, status.HTTP_200_OK)
        self.assertIn("internal_notes", res_recruiter.data)
        self.assertEqual(res_recruiter.data["internal_notes"], "Private Recruiter Note: Check salary expectations.")
