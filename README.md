# JobHub – Full Stack Job Portal with ATS Resume Screening

A full-stack job portal application built using React.js, Python, Django REST Framework, and PostgreSQL. JobHub connects job seekers and recruiters while simplifying the recruitment process through resume screening, job matching, and application management.

## Project Overview

JobHub is designed to provide a centralized platform where candidates can explore job opportunities, submit applications, and track their application progress. Recruiters can publish job openings, manage applications, review candidate resumes, and use ATS-based resume screening to evaluate candidate-job relevance.

## Key Features

### Candidate Module
- User registration and authentication.
- Browse available job opportunities.
- Search and filter jobs.
- View detailed job descriptions.
- Apply for jobs and submit resumes.
- AI-assisted resume and job matching.
- View matched and missing skills.
- Track application status and history.
- Manage candidate profile information.

### Recruiter Module
- Recruiter registration and authentication.
- Dedicated recruiter dashboard.
- Create, update, and delete job postings.
- View candidate applications.
- Access and download submitted resumes.
- ATS-based resume screening.
- Identify matching and missing skills.
- Generate candidate-job match scores.
- Update application statuses.
- Provide candidate feedback.

### ATS Resume Screening
- Extract text from supported resumes.
- Analyze resume content against job requirements.
- Identify relevant skills and keywords.
- Compare candidate qualifications with job descriptions.
- Generate a resume-job matching score.
- Display matching and missing skills to recruiters.

ATS results are intended to assist recruiters during candidate evaluation and should not replace human decision-making.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, JavaScript, HTML, CSS |
| Backend | Python, Django |
| API Development | Django REST Framework |
| Database | PostgreSQL |
| Authentication | JWT |
| API Integration | Axios |
| Frontend Build Tool | Vite |
| AI / Resume Processing | Python-based resume parsing and matching services |
| Version Control | Git and GitHub |

## Application Workflow

### Candidate Workflow
1. Register or log in.
2. Browse available job opportunities.
3. View job descriptions and requirements.
4. Submit an application with a resume.
5. View resume-job matching information where available.
6. Track application status through the candidate dashboard.

### Recruiter Workflow
1. Register or log in as a recruiter.
2. Create and manage job postings.
3. Review applications submitted by candidates.
4. View or download candidate resumes.
5. Run ATS resume screening.
6. Review matching skills, missing skills, and match scores.
7. Update application statuses and provide feedback.

## Application Screenshots

Add your actual application screenshots to a folder named `screenshots` in the project root.

Suggested screenshots:

| Screenshot | Description |
|---|---|
| Homepage | Job listings and job search |
| Job Details | Job description and application |
| Candidate Dashboard | Candidate applications and status |
| Recruiter Dashboard | Recruiter job and application management |
| ATS Screening | Resume analysis and matching results |

Example:

```text
screenshots/
├── homepage.png
├── job-details.png
├── candidate-dashboard.png
├── recruiter-dashboard.png
└── ats-screening.png
```

You can display them in this README using:

```markdown
![JobHub Homepage](screenshots/homepage.png)

![ATS Resume Screening](screenshots/ats-screening.png)
```

## Project Structure

```text
FullStack-JobHub/
│
├── backend/
│   ├── applications/
│   │   ├── migrations/
│   │   ├── services/
│   │   │   └── ats_scanner.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   │
│   ├── job_ai/
│   │   ├── migrations/
│   │   ├── services/
│   │   │   ├── matching.py
│   │   │   ├── pdf_parser.py
│   │   │   ├── schemas.py
│   │   │   └── vector_store.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── views.py
│   │
│   ├── jobs/
│   ├── users/
│   ├── config/
│   └── manage.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ResumeIntelligence.jsx
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── App.css
│   ├── package.json
│   └── vite.config.js
│
├── screenshots/
├── .gitignore
└── README.md
```

## Installation and Setup

### Prerequisites

Make sure the following are installed:

- Python
- Node.js and npm
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Habeeb-266/JobHub.git

cd JobHub
```

### 2. Backend Setup

Create and activate a virtual environment.

Windows:

```bash
python -m venv venv

venv\Scripts\activate
```

Install backend dependencies:

```bash
cd backend

pip install -r requirements.txt
```

Configure your environment variables and PostgreSQL database according to the backend settings.

### 3. Database Migration

Run the following commands:

```bash
python manage.py makemigrations

python manage.py migrate
```

### 4. Create Superuser

```bash
python manage.py createsuperuser
```

### 5. Start Backend Server

```bash
python manage.py runserver
```

Backend development server:

```text
http://127.0.0.1:8000/
```

### 6. Frontend Setup

Open another terminal:

```bash
cd frontend

npm install
```

Start the React development server:

```bash
npm run dev
```

Open the local frontend URL displayed by Vite in your terminal.

## Testing

Run backend tests:

```bash
cd backend

python manage.py test
```

Check Django configuration:

```bash
python manage.py check
```

Build the frontend for production:

```bash
cd frontend

npm run build
```

## Security Considerations

- Authentication is implemented using JWT.
- Role-based access controls distinguish candidates and recruiters.
- Resume access should be restricted to authorized users.
- Environment variables should be used for sensitive configuration.
- Never commit `.env` files, passwords, secret keys, or database credentials.
- ATS screening results should support human recruitment decisions rather than automatically determine candidate selection.

## Future Enhancements

- Email notifications for application status updates.
- Interview scheduling and calendar integration.
- Advanced resume analysis and matching.
- Recruiter analytics dashboard.
- Candidate recommendations based on job requirements.
- Cloud-based deployment and storage.

## Learning Outcomes

Developing JobHub provided practical experience in:

- Full-stack web application development.
- Building REST APIs using Django REST Framework.
- React frontend development and API integration.
- Database design and management using PostgreSQL.
- JWT authentication and role-based authorization.
- Resume processing and ATS-based matching.
- Application workflow and recruitment management.
- Git and GitHub version control.

## Author

**Habeeb Jaffer**

MCA Graduate | Aspiring Software Developer

- GitHub: https://github.com/Habeeb-266
- LinkedIn: https://www.linkedin.com/in/habeeb-jaffer-b4a525326/

---

If you find this project interesting, feel free to explore the repository and share your feedback.

**Thank you for visiting JobHub!**
