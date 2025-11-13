# 📋 Data Format Guide for Examify

## 📝 Questions Format

### Excel File Format for Questions

When creating an exam, you need to upload an Excel file (`.xlsx` or `.xls`) with the following format:

**Format:**

- **File Type**: Excel (.xlsx or .xls)
- **Structure**: Single column with questions
- **Column**: First column (Column A) contains the questions
- **Rows**: One question per row

**Example Excel Structure:**

| Column A (Questions)                            |
| ----------------------------------------------- |
| What is React?                                  |
| Explain useState hook                           |
| What is the difference between props and state? |
| How do you handle events in React?              |
| What is JSX?                                    |

**Important Notes:**

- Questions are read from the **first column only** (Column A)
- Each row represents one question
- Empty rows are automatically filtered out
- Questions can be edited after upload in the Create Exam form
- Questions can be deleted individually before creating the exam

**Where to Upload:**

- Navigate to **Teacher Panel** → Click **"Create Exam"** → Upload Excel file in the "Upload Questions" section

**Question Set Generation:**

- **Internal/External Exams**: Questions are grouped into sets of 3 (every 3 questions = 1 set)
- **10-Viva**: Questions are shuffled and grouped into sets of 10
- **15-Viva**: Questions are shuffled and grouped into sets of 15

---

## 👥 Student Details Format

### Current System: Automatic Registration

**⚠️ IMPORTANT: There is NO bulk upload functionality for students currently.**

Students are **automatically registered** when they:

1. Log in using Google OAuth
2. Have an email ending with `@rguktn.ac.in`

**Student Data Structure:**
When a student logs in for the first time, the system automatically creates a user record with:

```json
{
  "id": "ObjectID",
  "name": "Student Name (from Google)",
  "email": "student@rguktn.ac.in",
  "role": "student",
  "google_id": "Google ID",
  "image": "Google Profile Picture URL",
  "container_id": "ObjectID",
  "created_at": "DateTime",
  "updated_at": "DateTime"
}
```

**Student Registration Process:**

1. Student clicks "Login with Google"
2. System checks if email ends with `@rguktn.ac.in`
3. If yes → Creates student account automatically
4. If no → Access denied (unless in teacher whitelist)

**Student Container:**
Each student gets a container that stores:

- Exam IDs they've taken
- Answer Sheet IDs
- Copy violation status

---

## 📧 Email Invitation System

There is a **Send Emails** feature in the Teacher Panel that sends invitation emails to students, but this:

- **Does NOT bulk upload students**
- Only sends invitation emails to a hardcoded list of email addresses
- Students still need to log in via Google OAuth to register

**Location:** `backend/controllers/exam_controller.go` - `SendEmails()` function

**Current Implementation:**

- Email list is hardcoded in the backend
- Teachers can click "Send Emails" button in Teacher Panel
- Emails are sent to invite students to take the exam

---

## 🔧 Exam Data Format

When creating an exam via API or form, the data structure is:

```json
{
  "name": "Exam Name",
  "duration": 60,  // Duration in minutes
  "exam_type": "internal" | "external" | "viva" | "coaviva",
  "questions": [
    "Question 1 text",
    "Question 2 text",
    "Question 3 text"
  ]
}
```

**Exam Types:**

- `internal`: Internal exam (3 questions per set)
- `external`: External exam (3 questions per set)
- `viva`: 10-bit Viva (10 questions per set, shuffled)
- `coaviva`: 15-bit Viva (15 questions per set, shuffled)

---

## 📊 Answer Sheet Format

Answer sheets are automatically created when a student starts an exam:

```json
{
  "exam_id": "ObjectID",
  "exam_type": "internal" | "external" | "viva" | "coaviva",
  "duration": 60,
  "set_number": 1,
  "student_name": "Student Name",
  "student_email": "student@rguktn.ac.in",
  "data": [
    {"Question 1": "Answer 1"},
    {"Question 2": "Answer 2"}
  ],
  "ai_score": 85.5,
  "copied": false,
  "copy_count": 0,
  "submit_status": false
}
```

---

## 🚫 Missing Feature: Student Bulk Upload

**Currently, there is NO functionality to:**

- Bulk upload student data from Excel/CSV
- Import student lists
- Pre-register students before they log in

**Workaround:**

- Students must log in individually via Google OAuth
- The system automatically creates their account on first login
- You can send invitation emails (but students still need to log in)

**If you need bulk upload functionality**, it would need to be implemented as a new feature.

---

## 📍 File Locations

- **Question Upload**: `frontend/src/pages/CreateExam.jsx` (lines 28-65)
- **Student Registration**: `backend/controllers/auth_controller.go` (lines 75-175)
- **Email Sending**: `backend/controllers/exam_controller.go` (lines 311-363)
- **Data Models**: `backend/models/models.go`

---

## 💡 Tips

1. **For Questions**: Prepare your Excel file with one question per row in Column A
2. **For Students**: Ensure they have RGUKT email addresses (`@rguktn.ac.in`)
3. **For Teachers**: Add teacher emails to the whitelist in `backend/controllers/auth_controller.go`
4. **Example Excel**: Check `frontend/src/web_technologies_questions.xlsx` for reference
