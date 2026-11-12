from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ContactInfoSchema(BaseModel):
    name: Optional[str] = Field(default="", description="Candidate full name")
    email: Optional[str] = Field(default="", description="Candidate email address")
    phone: Optional[str] = Field(default="", description="Candidate contact phone number")
    linkedin: Optional[str] = Field(default="", description="LinkedIn profile URL")
    github: Optional[str] = Field(default="", description="GitHub profile URL")


class EducationItemSchema(BaseModel):
    institution: str = Field(default="", description="University, college, or institution name")
    degree: str = Field(default="", description="Degree level (e.g. B.Tech, B.S., M.S.)")
    field_of_study: Optional[str] = Field(default="", description="Major or field of study")
    year: Optional[str] = Field(default="", description="Graduation year or date range")


class WorkExperienceItemSchema(BaseModel):
    company: str = Field(default="", description="Organization or company name")
    title: str = Field(default="", description="Job title or role")
    duration: Optional[str] = Field(default="", description="Duration of employment")
    description: Optional[str] = Field(default="", description="Summary of responsibilities")


class ParsedResumeSchema(BaseModel):
    contact_info: ContactInfoSchema = Field(default_factory=ContactInfoSchema)
    summary: str = Field(default="", description="Professional summary or bio")
    skills: List[str] = Field(default_factory=list, description="Extracted and normalized technical skills")
    experience_years: float = Field(default=0.0, description="Estimated total years of professional experience")
    education: List[EducationItemSchema] = Field(default_factory=list)
    work_history: List[WorkExperienceItemSchema] = Field(default_factory=list)

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, skills: List[str]) -> List[str]:
        cleaned = []
        seen = set()
        for skill in skills:
            normalized = skill.strip()
            if normalized and normalized.lower() not in seen:
                seen.add(normalized.lower())
                cleaned.append(normalized)
        return cleaned

    @field_validator("experience_years")
    @classmethod
    def round_experience(cls, val: float) -> float:
        return max(0.0, round(float(val), 1))
