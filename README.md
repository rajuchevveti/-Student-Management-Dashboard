Project Documentation: Robotics Academy Student Management System
1. Project Overview
The Robotics Academy Student Management System is a web application built using Python (Flask) designed to help educators manage and monitor students. It provides a dashboard for a high-level overview and detailed pages for managing students, classes, assignments, and grades.
All data is stored in a single data.json file, which acts as a simple, file-based database. The application is interactive, allowing for real-time updates to grades and student information without requiring a full page reload, and includes features for adding, editing, and deleting records.
2. Technology Stack
Backend: Python 3, Flask (as the web server and for routing/logic).
Frontend: HTML5, Jinja2 (for templating), Tailwind CSS (via CDN for styling), and Vanilla JavaScript (ES6+ for all interactivity).
Data Storage: A single data.json file.
PDF Generation: fpdf2 (a pure-Python library for creating PDF documents).
3. Core Features
Dashboard: A central hub showing key statistics:
Total number of students.
School-wide average grade (Overall Grade).
Distribution of students by status (Excellent, Good, Needs Help, At Risk).
A grid of all classes, filterable by grade and section.
A list of recent alerts for at-risk students or overdue assignments.
A global student search bar.
Student Management:
A comprehensive list of all students on the "All Students" page, with filtering by class and status.
Ability to add new students via a modal form (UID and Roll Number are auto-generated).
A detailed "Student Profile" page for each student.
Ability to edit or delete students from their profile page.
Assignment Management:
A list of all created assignments (Projects, Labs, Homework, Tests, etc.) on the "Assignments" page.
Calculated average score and graded count for each assignment card.
Ability to add new assignments of any type via a modal form.
Grading System:
Overall Grade: Each student has one "Overall Grade" (editable on the Class View page) which determines their main status.
Specific Scores: Each student receives individual scores for each assignment/test.
Gradebook Page: A dedicated page to select any assignment (Project, Test, etc.) and any class to view, enter, and update the specific scores for all students in that class.
Reporting:
Ability to generate a downloadable, multi-page PDF report for any student from their profile page.
Data Control:
A "Settings" page with a "Reset Data" function to wipe all data and restore the application to its default demo state.
4. File Structure
your-project/
├── app.py                  # Main Flask application, routes, and all backend logic.
├── data.json               # File-based database (stores classes, students, assignments, grades).
├── static/
│   ├── style.css           # Custom CSS for sidebar, layout, and component styling.
│   └── script.js           # All frontend JavaScript for interactivity (modals, AJAX, filtering).
└── templates/
    ├── base.html           # Main template with sidebar, header. All other pages extend this.
    ├── dashboard.html      # Home page with statistics and class grid.
    ├── students.html       # "All Students" list page + "Add Student" modal.
    ├── class_view.html     # Page showing the roster for a single class.
    ├── student_profile.html  # Detailed page for one student + "Edit/Delete Student" modal.
    ├── assignments.html    # "All Assignments" list page + "Add Assignment" modal.
    ├── gradebook.html      # (Formerly assessments.html) Page for entering scores for any assignment.
    ├── student_report.html # HTML template that is rendered for PDF generation.
    └── settings.html       # Page for app settings (e.g., reset data).


5. Core Logic Flow
Data Model (data.json)
classes: A list of class objects, e.g., {"id": "c1", "name": "Grade 6th", "section": "Tata", ...}.
students: A list of student objects, e.g., {"id": "s1", "classId": "c1", "name": "Student 1", "overallGrade": 85, ...}.
assignments: A list of assignment objects, e.g., {"id": "as1", "classId": "c1", "title": "Intro Lab", "type": "Lab", ...}.
grades: A dictionary mapping assignment IDs to student scores. This is the "gradebook."
"grades": {
    "as1": { "s1": 45, "s2": 50, "s3": 38 },
    "as2": { "s1": 88, "s2": 92 }
}


Backend (app.py)
Page Routes (GET): Routes like /, /students, /assignments, /gradebook, and /student/<id> load data from data.json, process it (e.g., calculate averages, map class names), and pass it to the corresponding render_template() call.
API Endpoints (POST): Routes like /add_student, /edit_student/<id>, /delete_student/<id>, /add_assignment, /update_grade, and /update_assignment_grade are designed to receive JSON data from JavaScript. They perform a specific action (validate data, add/update/delete list/dict item), call save_data(data) to update data.json, and return a jsonify({'success': True}) response.
PDF Route (GET): The /report/student/<id>/pdf route fetches all data for one student, uses the fpdf2 library to manually build a PDF document in memory, and returns it as a downloadable file.
Frontend (script.js)
DOMContentLoaded: The main entry point that attaches all necessary event listeners.
Modal Functions: A set of functions (showAddStudentModal, closeAddStudentModal, showEditStudentModal, etc.) manage the opening/closing of modal dialogs by adding/removing CSS classes.
Form Handlers (initialize...FormListener): These functions find their specific forms (e.g., #addStudentForm). They attach a submit listener that:
Calls e.preventDefault() to stop the browser from doing a default GET request.
Shows a loading state on the submit button.
Gathers form data into a JavaScript object.
Calls the appropriate API endpoint (e.g., fetch('/add_student', ...)).
On success: shows a "success" toast and reloads the page.
On failure: shows an "error" toast and re-enables the button.
Dynamic Updates (AJAX):
Functions like updateGrade (on Class View) and updateAssignmentGrade (on Gradebook) send fetch requests to update scores.
Crucially, on success, they do not reload the page. Instead, they call helper functions like updateStatusBadge and updateClassViewStats to find and update the relevant HTML on the page in real-time.
