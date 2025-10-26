from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, make_response
import json
import os
import csv
from datetime import datetime, timedelta
import math
# --- PDF Generation Import ---
try:
    from fpdf import FPDF
    # Import new enums for modern API
    from fpdf.enums import XPos, YPos
    FPDF_AVAILABLE = True
except ImportError:
    FPDF_AVAILABLE = False
    print("WARNING: fpdf2 not found. PDF generation will not work. Install with: pip install fpdf2")


app = Flask(__name__)

# --- Constants ---
DATA_FILE = 'data.json'
CLASSES = ['6th', '7th', '8th', '9th']
SECTIONS = ['Tata', 'Google', 'Infosys', 'Mahindra', 'Intel', 'Adobe', 'Verizon']
ASSIGNMENT_TYPES = ['Project', 'Quiz', 'Lab', 'Homework', 'Exam', 'Participation', 'Assessment', 'Test', 'Other']
ASSESSMENT_FILTER_TYPES = ['Quiz', 'Exam', 'Assessment', 'Test']
COMPANY_COLORS = {
    'Tata': 'bg-red-500', 'Google': 'bg-blue-500', 'Infosys': 'bg-purple-500',
    'Mahindra': 'bg-green-500', 'Intel': 'bg-sky-500', 'Adobe': 'bg-red-600',
    'Verizon': 'bg-amber-500'
}
DEFAULT_DATE_SORT_KEY = "9999-12-31"

# --- Data Handling Functions ---
def load_data():
    if os.path.exists(DATA_FILE):
        try:
            if os.path.getsize(DATA_FILE) == 0: print(f"Warning: {DATA_FILE} empty. Creating default."); return create_default_data()
            with open(DATA_FILE, 'r', encoding='utf-8') as f: data = json.load(f)
            return ensure_data_structure(data) # Ensure structure immediately
        except json.JSONDecodeError as e: print(f"Error reading {DATA_FILE}: {e}. Creating default."); return create_default_data()
        except Exception as e: print(f"Unexpected error loading data: {e}"); return create_default_data()
    else: print(f"{DATA_FILE} not found. Creating default."); return create_default_data()

def ensure_data_structure(data):
    if not isinstance(data, dict): print("Data not dict. Creating default."); return create_default_data()
    required_keys = {'classes': [], 'students': [], 'alerts': [], 'assignments': [], 'grades': {}}
    needs_save = False
    for key, default in required_keys.items():
        current_value = data.get(key)
        if current_value is None: data[key] = default; needs_save = True
        elif key=='grades' and not isinstance(current_value,dict): data[key]=default; needs_save=True
        elif key!='grades' and not isinstance(current_value,list): data[key]=default; needs_save=True
        elif isinstance(current_value, list):
            valid_items = [item for item in current_value if isinstance(item, dict)]
            if len(valid_items) != len(current_value): print(f"Warning: Non-dict items removed from '{key}'."); data[key] = valid_items; needs_save = True
    if needs_save: print("Data structure corrected. Saving."); save_data(data)
    return data

def create_default_data():
    print("Creating default data...")
    # ...(Same default data creation)...
    default_data = {"classes": [], "students": [], "alerts": [], "assignments": [], "grades": {}}
    class_id_c = 1; student_id_c = 1
    for grade in CLASSES:
        for section in SECTIONS:
            c_id = f"c{class_id_c}"; class_data = {"id": c_id, "name": f"Grade {grade}", "section": section, "studentCount": 5, "color": COMPANY_COLORS[section], "grade": grade, "campus": "Main Campus"}; default_data["classes"].append(class_data)
            for i in range(1, 6):
                s_id = f"s{student_id_c}"; student = {"id": s_id, "classId": c_id, "name": f"Student {student_id_c}", "email": f"student{student_id_c}@school.edu", "overallGrade": 70+(student_id_c%30), "status": "Active", "lastMilestone": "Initial Setup", "uid": f"UID{1000 + student_id_c}", "rollNumber": f"ROLL{student_id_c:03d}", "campus": "Main Campus", "photo": f"/static/avatars/student{(student_id_c % 5) + 1}.jpg", "parentPhone": "+91 98765 43210", "joinDate": datetime.now().strftime('%Y-%m-%d'), "roboticsTeam": f"Team {section}", "skills": ["Programming", "Problem Solving"]}; student['status'] = get_status_from_grade(student['overallGrade']); default_data["students"].append(student); student_id_c += 1
            class_id_c += 1
    default_data["alerts"] = [{"id": "a1", "studentId": "s5", "classId": "c1", "issue": "Low score on Quiz 1", "type": "grade"}, {"id": "a2", "studentId": "s12", "classId": "c3", "issue": "Overall grade dropped below 60%", "type": "grade"}, {"id": "a3", "studentId": "s25", "classId": "c5", "issue": "Project 'RoboDesign' overdue", "type": "assignment"}]
    default_data["assignments"] = [{"id": "as1", "classId": "c1", "title": "Intro Circuit Lab", "dueDate": (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d'), "totalPoints": 50, "type": "Lab"}, {"id": "as2", "classId": "c1", "title": "Unit 1 Test", "dueDate": (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d'), "totalPoints": 100, "type": "Test"}, {"id": "as3", "classId": "c2", "title": "Algorithm Quiz", "dueDate": (datetime.now() + timedelta(days=9)).strftime('%Y-%m-%d'), "totalPoints": 20, "type": "Quiz"}]
    default_data["grades"] = {"as1": {"s1": 40, "s2": 45, "s3": 35}, "as2": {"s1": 78, "s2": 85, "s4": 91}, "as3": {"s6": 15, "s7": 18}}
    save_data(default_data); return default_data

def save_data(data):
    try:
        if not isinstance(data.get('grades'), dict): data['grades'] = {}
        if not isinstance(data.get('assignments'), list): data['assignments'] = []
        with open(DATA_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, indent=2)
    except Exception as e: print(f"Error saving data: {e}")

# --- Helper Function ---
def get_status_from_grade(grade):
    if grade is None: return 'N/A'
    if not isinstance(grade, (int, float)): return 'Invalid'
    if grade >= 90: return 'Excellent'
    if grade >= 70: return 'Good'
    if grade >= 60: return 'Needs Help'
    return 'At Risk'

# --- PDF Generation Helper Class ---
class PDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 12)
        self.cell(0, 10, 'Robotics Academy - Student Report', new_x=XPos.RIGHT, new_y=YPos.TOP, align='C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', new_x=XPos.RIGHT, new_y=YPos.TOP, align='C')
# --- End Helper Class ---


# --- Routes ---
@app.route('/')
def dashboard():
    data = load_data()
    selected_grade = request.args.get('grade', '')
    selected_section = request.args.get('section', '')
    all_classes = data.get('classes', [])
    filtered_classes = [c for c in all_classes if (not selected_grade or c.get('grade') == selected_grade) and (not selected_section or c.get('section') == selected_section)]
    all_students = data.get('students', [])
    
    # --- UPDATED: Reverted to correct logic ---
    total_students = len(all_students)
    print(f"DEBUG: Found {len(all_students)} students in data.get('students')")
    # --- END UPDATE ---

    if total_students > 0:
        valid_grades = [s.get('overallGrade', 0) for s in all_students if isinstance(s, dict) and isinstance(s.get('overallGrade'), (int, float))]
        avg_grade = sum(valid_grades) / len(valid_grades) if valid_grades else 0
        
        status_counts = {'Excellent': 0, 'Good': 0, 'Needs Help': 0, 'At Risk': 0, 'N/A': 0, 'Invalid': 0}
        for s in all_students:
             if isinstance(s, dict): 
                 status = get_status_from_grade(s.get('overallGrade'))
                 if status not in status_counts: status = 'Invalid' # Handle edge cases
                 status_counts[status] = status_counts.get(status, 0) + 1
    else: 
        avg_grade = 0
        status_counts = {k: 0 for k in ['Excellent', 'Good', 'Needs Help', 'At Risk', 'N/A', 'Invalid']}
        
    alerts_display = []; class_map = {c.get('id'): c for c in all_classes if isinstance(c,dict)}; student_map = {s.get('id'): s for s in all_students if isinstance(s,dict)}
    for alert in data.get('alerts', []):
        if not isinstance(alert, dict): continue
        student = student_map.get(alert.get('studentId')); class_info = class_map.get(alert.get('classId'))
        if student and class_info: 
            alert_copy = alert.copy()
            alert_copy['studentName'] = student.get('name', 'Unknown')
            alert_copy['className'] = f"{class_info.get('name', '')} - {class_info.get('section', '')}"
            alerts_display.append(alert_copy)
    
    # --- ADDED FINAL DEBUG PRINT ---
    print(f"DEBUG: Rendering dashboard with total_students = {total_students}")
    # --- END DEBUG ---
        
    return render_template('dashboard.html', 
                           classes=filtered_classes, all_classes=all_classes, alerts=alerts_display,
                           total_students=total_students, # This will pass the real count
                           avg_grade=round(avg_grade), status_counts=status_counts,
                           selected_grade=selected_grade, selected_section=selected_section,
                           available_grades=CLASSES, available_sections=SECTIONS)


@app.route('/students')
def students():
    # ...(No changes needed here)...
    data = load_data(); all_students = data.get('students', []); all_classes = data.get('classes', [])
    class_map = {c.get('id'): c for c in all_classes if isinstance(c,dict)}
    valid_students = []
    for student in all_students:
        if not isinstance(student, dict): continue
        class_info = class_map.get(student.get('classId')); student['className'] = f"{class_info.get('name', '')} - {class_info.get('section', '')}" if class_info else "N/A"
        student['status'] = get_status_from_grade(student.get('overallGrade', 0))
        valid_students.append(student)
    return render_template('students.html', students=valid_students, class_data=None, all_classes=all_classes)

@app.route('/assignments')
def assignments():
    # ...(No changes needed here)...
    data = load_data(); all_assignments_raw = data.get('assignments', []); all_classes = data.get('classes', [])
    class_map = {c.get('id'): c for c in all_classes if isinstance(c,dict)}; all_grades = data.get('grades', {})
    if not isinstance(all_grades, dict): print("Warning: Grades data not dict."); all_grades = {}
    processed_assignments = []
    for assignment in all_assignments_raw:
        if not isinstance(assignment, dict) or 'id' not in assignment: print(f"Skipping invalid: {assignment}"); continue
        assignment_id = assignment['id']; class_id = assignment.get('classId'); class_info = class_map.get(class_id)
        assignment['className'] = f"{class_info.get('name', '')} - {class_info.get('section', '')}" if class_info else "Unknown"; assignment['classColor'] = class_info.get('color', 'bg-gray-500') if class_info else 'bg-gray-500'
        assignment_grades_dict = all_grades.get(assignment_id, {}); valid_grades_list = []
        if isinstance(assignment_grades_dict, dict): valid_grades_list = [g for g in assignment_grades_dict.values() if isinstance(g, (int, float))]
        graded_count = len(valid_grades_list); assignment['averageGrade'] = round(sum(valid_grades_list)/graded_count) if graded_count > 0 else None; assignment['gradedCount'] = graded_count; processed_assignments.append(assignment)
    processed_assignments.sort(key=lambda x: x.get('dueDate', DEFAULT_DATE_SORT_KEY))
    return render_template('assignments.html', assignments=processed_assignments, class_data=None, all_classes=all_classes, assignment_types=ASSIGNMENT_TYPES)


@app.route('/gradebook') # Renamed from /assessments
def gradebook():
    # ...(No changes needed here)...
    data = load_data(); all_assignments = data.get('assignments', []); all_classes = data.get('classes', []); all_students = data.get('students', []); all_grades = data.get('grades', {})
    assignment_options = [a for a in all_assignments if isinstance(a, dict)] # Show ALL assignments
    assignment_options.sort(key=lambda x: x.get('dueDate', DEFAULT_DATE_SORT_KEY), reverse=True)
    selected_assignment_id = request.args.get('assignment_id', ''); selected_class_id = request.args.get('class_id', '')
    selected_assignment = next((a for a in all_assignments if a.get('id') == selected_assignment_id), None)
    if selected_assignment and not selected_class_id: selected_class_id = selected_assignment.get('classId') # Auto-select class
    selected_class = next((c for c in all_classes if isinstance(c, dict) and c.get('id') == selected_class_id), None)
    filtered_students = []; student_scores = {}
    if selected_assignment and selected_class:
        if selected_assignment.get('classId') == selected_class_id: # Only show if class matches
             filtered_students = [s for s in all_students if isinstance(s, dict) and s.get('classId') == selected_class_id]; filtered_students.sort(key=lambda x: x.get('name', ''))
             student_scores = all_grades.get(selected_assignment_id, {})
             if not isinstance(student_scores, dict): student_scores = {}
        else: filtered_students = []; student_scores = {} # Class mismatch
    return render_template('gradebook.html',
                           assignment_options=assignment_options, all_classes=all_classes,
                           selected_assignment_id=selected_assignment_id, selected_class_id=selected_class_id,
                           selected_assignment=selected_assignment, selected_class=selected_class,
                           students=filtered_students, scores=student_scores)


@app.route('/settings')
def settings(): return render_template('settings.html')

@app.route('/search')
def search_students():
    # ...(No changes needed here)...
    query = request.args.get('q', '').lower(); data = load_data()
    students = data.get('students', []); class_map = {c.get('id'): c for c in data.get('classes', []) if isinstance(c,dict)}
    results = [s for s in students if isinstance(s, dict) and query and (query in s.get('name', '').lower() or query in s.get('email', '').lower() or query in s.get('uid', '').lower())]
    for res in results: 
        class_info = class_map.get(res.get('classId'))
        res['className'] = f"{class_info['name']} - {class_info['section']}" if class_info else "N/A"
    return jsonify(results)

@app.route('/class/<class_id>')
def class_view(class_id):
    # ...(No changes needed here)...
    data = load_data(); current_class = next((c for c in data.get('classes', []) if isinstance(c, dict) and c.get('id') == class_id), None)
    if not current_class: return "Class not found", 404
    class_students = [s for s in data.get('students', []) if isinstance(s, dict) and s.get('classId') == class_id]
    return render_template('class_view.html', class_data=current_class, students=class_students)

@app.route('/student/<student_id>')
def student_profile(student_id):
    # ...(No changes needed here)...
    data = load_data(); student = next((s for s in data.get('students', []) if isinstance(s, dict) and s.get('id') == student_id), None)
    if not student: return "Student not found", 404
    student_class = next((c for c in data.get('classes', []) if isinstance(c, dict) and c.get('id') == student.get('classId')), {})
    student['className'] = f"{student_class.get('name', '')} - {student_class.get('section', '')}"
    student_assignments_view = []; all_grades = data.get('grades', {}); 
    if not isinstance(all_grades, dict): all_grades = {}
    all_assignments = data.get('assignments', []); 
    if not isinstance(all_assignments, list): all_assignments = []
    for assignment in all_assignments:
        if not isinstance(assignment, dict) or 'id' not in assignment: continue
        if assignment.get('classId') == student.get('classId'):
            assignment_copy = assignment.copy(); assignment_grades = all_grades.get(assignment['id'], {}); 
            if not isinstance(assignment_grades, dict): assignment_grades = {}
            student_score = assignment_grades.get(student_id); assignment_copy['score'] = student_score
            student_assignments_view.append(assignment_copy)
    student_assignments_view.sort(key=lambda x: x.get('dueDate', DEFAULT_DATE_SORT_KEY))
    student['status'] = get_status_from_grade(student.get('overallGrade', 0)); student['skills'] = student.get('skills', [])
    all_classes = data.get('classes', [])
    return render_template('student_profile.html', student=student, assignments=student_assignments_view, class_data=student_class, all_classes=all_classes)

# --- HTML Report Route ---
@app.route('/report/student/<student_id>')
def student_report_html(student_id):
    # ...(No changes needed here)...
    data = load_data(); student = next((s for s in data.get('students', []) if isinstance(s, dict) and s.get('id') == student_id), None)
    if not student: return "Student not found", 404
    student_class = next((c for c in data.get('classes', []) if isinstance(c, dict) and c.get('id') == student.get('classId')), {})
    student['className'] = f"{student_class.get('name', '')} - {student_class.get('section', '')}"
    student_assignments_view = []; all_grades = data.get('grades', {}); 
    if not isinstance(all_grades, dict): all_grades = {}
    all_assignments = data.get('assignments', []); 
    if not isinstance(all_assignments, list): all_assignments = []
    for assignment in all_assignments:
        if not isinstance(assignment, dict) or 'id' not in assignment: continue
        if assignment.get('classId') == student.get('classId'):
            assignment_copy = assignment.copy(); assignment_grades = all_grades.get(assignment['id'], {}); 
            if not isinstance(assignment_grades, dict): assignment_grades = {}
            student_score = assignment_grades.get(student_id); assignment_copy['score'] = student_score
            student_assignments_view.append(assignment_copy)
    student_assignments_view.sort(key=lambda x: x.get('dueDate', DEFAULT_DATE_SORT_KEY))
    student['status'] = get_status_from_grade(student.get('overallGrade', 0)); student['skills'] = student.get('skills', [])
    generation_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return render_template('student_report.html', student=student, assignments=student_assignments_view, generated_date=generation_date)


# --- PDF Report Route (fpdf2) ---
@app.route('/report/student/<student_id>/pdf')
def student_report_pdf(student_id):
    # ...(No changes needed here)...
    if not FPDF_AVAILABLE: return "PDF generation library (fpdf2) not installed. Please install it: pip install fpdf2", 501
    data = load_data(); student = next((s for s in data.get('students', []) if isinstance(s, dict) and s.get('id') == student_id), None)
    if not student: return "Student not found", 404
    student_class = next((c for c in data.get('classes', []) if isinstance(c, dict) and c.get('id') == student.get('classId')), {})
    student['className'] = f"{student_class.get('name', '')} - {student_class.get('section', '')}"
    student_assignments_view = []; all_grades = data.get('grades', {}); 
    if not isinstance(all_grades, dict): all_grades = {}
    all_assignments = data.get('assignments', []); 
    if not isinstance(all_assignments, list): all_assignments = []
    for assignment in all_assignments:
        if not isinstance(assignment, dict) or 'id' not in assignment: continue
        if assignment.get('classId') == student.get('classId'):
            assignment_copy = assignment.copy(); assignment_grades = all_grades.get(assignment['id'], {}); 
            if not isinstance(assignment_grades, dict): assignment_grades = {}
            student_score = assignment_grades.get(student_id); assignment_copy['score'] = student_score
            student_assignments_view.append(assignment_copy)
    student_assignments_view.sort(key=lambda x: x.get('dueDate', DEFAULT_DATE_SORT_KEY))
    student['status'] = get_status_from_grade(student.get('overallGrade', 0)); student['skills'] = student.get('skills', [])
    generation_date = datetime.now().strftime('%Y-%m-%d')
    try:
        pdf = PDF(orientation='P', unit='mm', format='A4'); pdf.add_page(); pdf.set_auto_page_break(auto=True, margin=15); pdf.set_font('Helvetica', '', 10)
        pdf.set_font('Helvetica', 'B', 18); pdf.cell(0, 10, student.get('name', 'Unknown Student'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        pdf.set_font('Helvetica', '', 10); pdf.cell(0, 6, f"Class: {student.get('className', 'N/A')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L'); pdf.cell(0, 6, f"UID: {student.get('uid', '-')} | Roll No: {student.get('rollNumber', '-')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L'); pdf.cell(0, 6, f"Report Generated: {generation_date}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L'); pdf.ln(5)
        pdf.set_font('Helvetica', 'B', 14); pdf.cell(0, 10, "Overall Performance", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        pdf.set_font('Helvetica', '', 10); pdf.set_fill_color(248, 250, 252)
        pdf.cell(95, 10, "Overall Grade:", border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='L', fill=True); pdf.set_font('Helvetica', 'B', 12); pdf.cell(95, 10, f"{student.get('overallGrade', 0)}%", border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='R', fill=True)
        pdf.set_font('Helvetica', '', 10); pdf.cell(95, 10, "Status:", border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='L', fill=True); pdf.set_font('Helvetica', 'B', 12); pdf.cell(95, 10, student.get('status', 'N/A'), border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='R', fill=True); pdf.ln(10)
        pdf.set_font('Helvetica', 'B', 14); pdf.cell(0, 10, "Basic Information", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        pdf.set_font('Helvetica', '', 10); pdf.cell(40, 7, "Email:", new_x=XPos.RIGHT, new_y=YPos.TOP); pdf.cell(0, 7, student.get('email', '-'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L'); pdf.cell(40, 7, "Parent Phone:", new_x=XPos.RIGHT, new_y=YPos.TOP); pdf.cell(0, 7, student.get('parentPhone', '-'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L'); pdf.cell(40, 7, "Join Date:", new_x=XPos.RIGHT, new_y=YPos.TOP); pdf.cell(0, 7, student.get('joinDate', '-'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L'); pdf.cell(40, 7, "Robotics Team:", new_x=XPos.RIGHT, new_y=YPos.TOP); pdf.cell(0, 7, student.get('roboticsTeam', '-'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L'); pdf.ln(10)
        pdf.set_font('Helvetica', 'B', 14); pdf.cell(0, 10, "Skills", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        pdf.set_font('Helvetica', '', 10); skills_text = ", ".join(student.get('skills', [])) if student.get('skills') else "No skills listed."; pdf.multi_cell(0, 7, skills_text, align='L'); pdf.ln(10)
        if student_assignments_view:
            pdf.add_page(); pdf.set_font('Helvetica', 'B', 14); pdf.cell(0, 10, "Assignments & Scores", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
            pdf.set_font('Helvetica', 'B', 9); pdf.set_fill_color(248, 250, 252); col_widths = {'title': 70, 'type': 30, 'due': 25, 'max': 15, 'score': 15, 'pct': 15}
            pdf.cell(col_widths['title'], 7, "Title", border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='L', fill=True); pdf.cell(col_widths['type'], 7, "Type", border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='L', fill=True); pdf.cell(col_widths['due'], 7, "Due Date", border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='L', fill=True); pdf.cell(col_widths['max'], 7, "Max", border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='C', fill=True); pdf.cell(col_widths['score'], 7, "Score", border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='C', fill=True); pdf.cell(col_widths['pct'], 7, "%", border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C', fill=True)
            pdf.set_font('Helvetica', '', 9); fill = False
            for assignment in student_assignments_view:
                pdf.set_fill_color(255, 255, 255) if not fill else pdf.set_fill_color(248, 250, 252)
                pdf.cell(col_widths['title'], 8, str(assignment.get('title', '-'))[:40], border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='L', fill=True); pdf.cell(col_widths['type'], 8, str(assignment.get('type', '-')), border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='L', fill=True); pdf.cell(col_widths['due'], 8, str(assignment.get('dueDate', '-')), border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='L', fill=True); pdf.cell(col_widths['max'], 8, str(assignment.get('totalPoints', '-')), border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='C', fill=True)
                score = assignment.get('score'); score_str = str(score) if score is not None else '-'; pdf.cell(col_widths['score'], 8, score_str, border=1, new_x=XPos.RIGHT, new_y=YPos.TOP, align='C', fill=True)
                pct_str = '-';
                if score is not None and isinstance(assignment.get('totalPoints'), int) and assignment['totalPoints'] > 0: pct = round((score / assignment['totalPoints']) * 100); pct_str = f"{pct}%"
                pdf.cell(col_widths['pct'], 8, pct_str, border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C', fill=True)
                fill = not fill
        else: pdf.set_font('Helvetica', 'I', 10); pdf.cell(0, 10, "No assignments found for this student's class.", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        pdf_bytes = bytes(pdf.output()) 
        filename = f"Report_{student.get('name','Student').replace(' ','_')}_{datetime.now().strftime('%Y%m%d')}.pdf"
        response = make_response(pdf_bytes); response.headers['Content-Type'] = 'application/pdf'; response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'; return response
    except Exception as e: print(f"Error generating fpdf2 report for {student_id}: {e}"); return f"Error generating PDF report: {e}", 500


# --- API Endpoints ---
@app.route('/update_grade', methods=['POST'])
def update_grade():
    data = load_data(); student_id = request.json.get('student_id'); new_grade_str = request.json.get('new_grade')
    if not student_id or new_grade_str is None: return jsonify({'success': False, 'message': 'Missing data'}), 400
    try: new_grade = int(new_grade_str); assert 0 <= new_grade <= 100
    except (ValueError, AssertionError): return jsonify({'success': False, 'message': 'Invalid grade (0-100 required)'}), 400
    student_updated = False; students_list = data.get('students', [])
    for i, student in enumerate(students_list):
         if isinstance(student, dict) and student.get('id') == student_id: students_list[i]['overallGrade'] = new_grade; students_list[i]['status'] = get_status_from_grade(new_grade); student_updated = True; break
    if student_updated: save_data(data); return jsonify({'success': True})
    else: return jsonify({'success': False, 'message': 'Student not found'}), 404

@app.route('/update_assignment_grade', methods=['POST'])
def update_assignment_grade():
    data = load_data(); assignment_id = request.json.get('assignment_id'); student_id = request.json.get('student_id'); grade_input = request.json.get('grade')
    if not all([assignment_id, student_id]): return jsonify({'success': False, 'message': 'Missing ID(s)'}), 400
    assignment = next((a for a in data.get('assignments', []) if isinstance(a,dict) and a.get('id') == assignment_id), None)
    if not assignment: return jsonify({'success': False, 'message': 'Assignment not found'}), 404
    if not any(isinstance(s,dict) and s.get('id') == student_id for s in data.get('students',[])): return jsonify({'success': False, 'message': 'Student not found'}), 404
    total_points = assignment.get('totalPoints', 100); grade_to_save = None
    if grade_input is not None and grade_input != '':
        try: grade_num = int(grade_input); assert 0 <= grade_num <= total_points; grade_to_save = grade_num
        except (ValueError, TypeError, AssertionError): return jsonify({'success': False, 'message': f'Invalid score. Must be 0-{total_points} or empty.'}), 400
    if not isinstance(data.get('grades'), dict): data['grades'] = {}
    if assignment_id not in data['grades'] or not isinstance(data['grades'][assignment_id], dict): data['grades'][assignment_id] = {}
    if grade_to_save is not None: data['grades'][assignment_id][student_id] = grade_to_save
    elif student_id in data['grades'][assignment_id]: del data['grades'][assignment_id][student_id]
    save_data(data); return jsonify({'success': True})

@app.route('/add_assignment', methods=['POST'])
def add_assignment():
    data = load_data(); assignment_data = request.json
    required = ['class_id', 'title', 'due_date', 'total_points', 'type']
    if not assignment_data or not all(f in assignment_data for f in required): return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    try: total_points = int(assignment_data['total_points']); assert total_points > 0
    except (ValueError, TypeError, AssertionError): return jsonify({'success': False, 'message': 'Total points must be a positive number.'}), 400
    if not isinstance(assignment_data.get('title'), str) or not assignment_data['title'].strip(): return jsonify({'success': False, 'message': 'Title cannot be empty.'}), 400
    if not isinstance(assignment_data.get('due_date'), str) or not assignment_data['due_date']: return jsonify({'success': False, 'message': 'Due date is required.'}), 400
    if assignment_data.get('type') not in ASSIGNMENT_TYPES: return jsonify({'success': False, 'message': 'Invalid assignment type.'}), 400
    if not any(isinstance(c, dict) and c.get('id') == assignment_data.get('class_id') for c in data.get('classes', [])): return jsonify({'success': False, 'message': 'Selected class not found.'}), 404
    if 'assignments' not in data or not isinstance(data['assignments'], list): data['assignments'] = []
    new_id_num = 1; existing_ids = {a.get('id') for a in data['assignments'] if isinstance(a, dict)}
    while f"as{new_id_num}" in existing_ids: new_id_num += 1
    new_assignment_id = f"as{new_id_num}"
    new_assignment = {'id': new_assignment_id, 'classId': assignment_data['class_id'], 'title': assignment_data['title'].strip(), 'dueDate': assignment_data['due_date'], 'totalPoints': total_points, 'type': assignment_data['type']}
    data['assignments'].append(new_assignment); save_data(data)
    print(f"Successfully added assignment: {new_assignment_id}")
    return jsonify({'success': True, 'assignment_id': new_assignment_id})

@app.route('/add_student', methods=['POST'])
def add_student():
    data = load_data(); student_data = request.json
    required_fields = ['name', 'email', 'classId']
    if not student_data or not all(f in student_data and student_data[f] for f in required_fields): return jsonify({'success': False, 'message': 'Missing required fields (Name, Email, Class).'}), 400
    new_email = student_data['email'].strip().lower()
    if any(isinstance(s,dict) and s.get('email','').lower() == new_email for s in data.get('students',[])): return jsonify({'success': False, 'message': f'Email "{new_email}" already exists.'}), 400
    if not any(isinstance(c, dict) and c.get('id') == student_data.get('classId') for c in data.get('classes', [])): return jsonify({'success': False, 'message': 'Selected class not found.'}), 404
    if 'students' not in data or not isinstance(data['students'], list): data['students'] = []
    highest_id_num = 0
    for s in data['students']:
        if isinstance(s, dict) and s.get('id', '').startswith('s'):
            try: num = int(s['id'][1:]); highest_id_num = max(highest_id_num, num)
            except ValueError: continue
    new_student_num = highest_id_num + 1; new_student_id = f"s{new_student_num}"; new_uid = f"UID{1000 + new_student_num}"; new_roll = f"ROLL{new_student_num:03d}"
    new_student = {'id': new_student_id, 'classId': student_data['classId'], 'name': student_data['name'].strip(), 'email': new_email, 'overallGrade': 70, 'status': get_status_from_grade(70), 'lastMilestone': 'Account Created', 'uid': new_uid, 'rollNumber': new_roll, 'campus': 'Main Campus', 'photo': f"/static/avatars/student{(new_student_num % 5) + 1}.jpg", 'parentPhone': student_data.get('parentPhone', ''), 'joinDate': datetime.now().strftime('%Y-%m-%d'), 'roboticsTeam': '', 'skills': student_data.get('skills', []) }
    class_info = next((c for c in data.get('classes', []) if c.get('id') == new_student['classId']), None)
    if class_info: new_student['roboticsTeam'] = f"Team {class_info.get('section', 'Unknown')}"
    for i, c in enumerate(data.get('classes', [])):
        if isinstance(c, dict) and c.get('id') == new_student['classId']: data['classes'][i]['studentCount'] = c.get('studentCount', 0) + 1; break
    data['students'].append(new_student); save_data(data)
    print(f"Successfully added student: {new_student_id}")
    return jsonify({'success': True, 'student_id': new_student_id})

@app.route('/edit_student/<student_id>', methods=['POST'])
def edit_student(student_id):
    data = load_data(); updated_data = request.json
    if not updated_data: return jsonify({'success': False, 'message': 'No data provided'}), 400
    student_index = -1; students_list = data.get('students', [])
    for i, student in enumerate(students_list):
        if isinstance(student, dict) and student.get('id') == student_id: student_index = i; break
    if student_index == -1: return jsonify({'success': False, 'message': 'Student not found'}), 404
    if not updated_data.get('name') or not updated_data.get('email') or not updated_data.get('classId'): return jsonify({'success': False, 'message': 'Name, Email, and Class are required.'}), 400
    new_email = updated_data['email'].strip().lower()
    if any(isinstance(s,dict) and s.get('email','').lower() == new_email and s.get('id') != student_id for s in students_list): return jsonify({'success': False, 'message': f'Email "{new_email}" is already used.'}), 400
    if not any(isinstance(c, dict) and c.get('id') == updated_data.get('classId') for c in data.get('classes', [])): return jsonify({'success': False, 'message': 'Selected class not found.'}), 404
    current_student = students_list[student_index]; original_class_id = current_student.get('classId'); new_class_id = updated_data['classId']
    current_student['name'] = updated_data['name'].strip(); current_student['email'] = new_email; current_student['classId'] = new_class_id
    current_student['parentPhone'] = updated_data.get('parentPhone', current_student.get('parentPhone', '')); current_student['skills'] = updated_data.get('skills', current_student.get('skills', []))
    if original_class_id != new_class_id:
        new_class_info = next((c for c in data.get('classes', []) if c.get('id') == new_class_id), None)
        current_student['roboticsTeam'] = f"Team {new_class_info.get('section', 'Unknown')}" if new_class_info else ''
        for i, c in enumerate(data.get('classes', [])):
            if isinstance(c, dict):
                 if c.get('id') == original_class_id: data['classes'][i]['studentCount'] = max(0, c.get('studentCount', 1) - 1)
                 elif c.get('id') == new_class_id: data['classes'][i]['studentCount'] = c.get('studentCount', 0) + 1
    save_data(data); print(f"Successfully updated student: {student_id}"); return jsonify({'success': True, 'student_id': student_id})

@app.route('/delete_student/<student_id>', methods=['POST'])
def delete_student(student_id):
    data = load_data(); students_list = data.get('students', []); initial_len = len(students_list); original_class_id = None; student_found = False
    data['students'] = []
    for student in students_list:
        if isinstance(student, dict) and student.get('id') == student_id: original_class_id = student.get('classId'); student_found = True
        else: data['students'].append(student)
    if not student_found: return jsonify({'success': False, 'message': 'Student not found'}), 404
    grades_dict = data.get('grades', {})
    if isinstance(grades_dict, dict):
        for assignment_id in list(grades_dict.keys()):
            if isinstance(grades_dict[assignment_id], dict) and student_id in grades_dict[assignment_id]: del grades_dict[assignment_id][student_id]
    if original_class_id:
        for i, c in enumerate(data.get('classes', [])):
            if isinstance(c, dict) and c.get('id') == original_class_id: data['classes'][i]['studentCount'] = max(0, c.get('studentCount', 1) - 1); break
    save_data(data); print(f"Successfully deleted student: {student_id}"); return jsonify({'success': True, 'message': 'Student deleted successfully'})

@app.route('/delete_assignment', methods=['POST'])
def delete_assignment():
     data = load_data(); assignment_id = request.json.get('assignment_id')
     if not assignment_id: return jsonify({'success': False, 'message': 'Missing assignment ID'}), 400
     initial_len = len(data.get('assignments', [])); data['assignments'] = [a for a in data.get('assignments', []) if not (isinstance(a, dict) and a.get('id') == assignment_id)]
     if assignment_id in data.get('grades', {}): del data['grades'][assignment_id]
     if len(data.get('assignments', [])) < initial_len: save_data(data); return jsonify({'success': True, 'message': 'Assignment deleted'})
     else: return jsonify({'success': False, 'message': 'Assignment not found'}), 404

# --- Other Routes ---
@app.route('/get_student_details')
def get_student_details():
    student_id = request.args.get('student_id');
    if not student_id: return jsonify({'error': 'ID required'}), 400
    data = load_data(); student = next((s for s in data.get('students', []) if isinstance(s, dict) and s.get('id') == student_id), None)
    if student:
        class_info = next((c for c in data.get('classes', []) if isinstance(c, dict) and c.get('id') == student.get('classId')), {})
        student['className'] = f"{class_info.get('name', '')} - {class_info.get('section', '')}"; student['status'] = get_status_from_grade(student.get('overallGrade', 0)); student['skills'] = student.get('skills', [])
        return jsonify(student)
    else: return jsonify({'error': 'Student not found'}), 404

@app.route('/export_grades/<class_id>')
def export_grades(class_id):
    data = load_data(); class_info = next((c for c in data.get('classes', []) if isinstance(c, dict) and c.get('id') == class_id), None)
    if not class_info: return "Class not found", 404
    filename = f"overall_grades_{class_info.get('grade','')}_{class_info.get('section','')}_{datetime.now().strftime('%Y%m%d')}.csv"
    filepath = os.path.join('.', filename)
    try:
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile); writer.writerow(['Student Name', 'Email', 'Overall Grade', 'Status', 'UID', 'Roll Number'])
            for student in data.get('students', []):
                 if isinstance(student, dict) and student.get('classId') == class_id: writer.writerow([student.get(k, '') for k in ['name', 'email', 'overallGrade', 'status', 'uid', 'rollNumber']])
        resp = send_file(filepath, as_attachment=True, download_name=filename)
        try: os.remove(filepath)
        except OSError as e: print(f"Error removing export file {filepath}: {e}")
        return resp
    except Exception as e:
        print(f"Error exporting grades: {e}")
        if os.path.exists(filepath):
            try: os.remove(filepath)
            except OSError as e_rem: print(f"Error removing file after export error {filepath}: {e_rem}")
        return "Error creating export file.", 500

@app.route('/reset_data', methods=['POST'])
def reset_data():
    try:
        # Just call create_default_data, which also saves/overwrites
        create_default_data()
        return jsonify({'success': True, 'message': 'Data reset to default'})
    except Exception as e:
        print(f"Error during data reset: {e}")
        return jsonify({'success': False, 'message': f'An error occurred: {e}'}), 500

# --- Make Python function available to Jinja ---
app.jinja_env.globals.update(get_status_from_grade=get_status_from_grade)

# --- Run App ---
if __name__ == '__main__':
    load_data()
    app.run(debug=True, host='0.0.0.0', port=5000)

