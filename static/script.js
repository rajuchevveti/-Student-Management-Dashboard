// Sidebar Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeSidebarToggle();
    initializeSearchFunctionality();
    initializePageSpecificFeatures();
    initializeAssignmentFormListener();
    initializeResetModalListeners();
    initializeStudentModalListeners(); // Handles BOTH student modals now
    initializeDropdownListeners();
    initializeAddStudentFormListener();
    initializeEditStudentFormListener(); // Initialize the EDIT form listener
});

// --- Sidebar ---
function initializeSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle'); // The hamburger button in the header
    const toggleIcon = document.getElementById('toggleIcon'); // The <i> tag inside the button
    const overlay = document.getElementById('overlay'); // For mobile overlay

    if (!sidebar || !toggleBtn || !toggleIcon || !overlay) {
        console.warn("Sidebar toggle elements not fully found. Toggle might not work.");
        return;
    }
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) { sidebar.classList.add('collapsed'); toggleIcon.className = 'fas fa-bars'; }
    else { sidebar.classList.remove('collapsed'); toggleIcon.className = 'fas fa-times'; if (window.innerWidth <= 768) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; } }
    toggleBtn.addEventListener('click', function() {
        const willBeCollapsed = !sidebar.classList.contains('collapsed'); sidebar.classList.toggle('collapsed');
        if (willBeCollapsed) { toggleIcon.className = 'fas fa-bars'; overlay.classList.remove('active'); document.body.style.overflow = ''; }
        else { toggleIcon.className = 'fas fa-times'; if (window.innerWidth <= 768) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; } }
        localStorage.setItem('sidebarCollapsed', willBeCollapsed);
    });
    overlay.addEventListener('click', function() { sidebar.classList.add('collapsed'); toggleIcon.className = 'fas fa-bars'; overlay.classList.remove('active'); document.body.style.overflow = ''; localStorage.setItem('sidebarCollapsed', true); });
    document.querySelectorAll('.nav-item').forEach(item => { item.addEventListener('click', function() { if (window.innerWidth <= 768 && !sidebar.classList.contains('collapsed')) { sidebar.classList.add('collapsed'); toggleIcon.className = 'fas fa-bars'; overlay.classList.remove('active'); document.body.style.overflow = ''; localStorage.setItem('sidebarCollapsed', true); } }); });
    window.addEventListener('resize', function() { if (window.innerWidth > 768) { if (overlay.classList.contains('active')) { overlay.classList.remove('active'); document.body.style.overflow = ''; } } else { if (!sidebar.classList.contains('collapsed')) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; } } });
}

// --- Search ---
function initializeSearchFunctionality() {
    const searchInput = document.getElementById('studentSearch');
    const resultsContainer = document.getElementById('searchResults');
    if (!searchInput || !resultsContainer) return;
    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        resultsContainer.innerHTML = ''; if (query.length < 2) { resultsContainer.classList.add('hidden'); return; }
        resultsContainer.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Searching...</div>'; resultsContainer.classList.remove('hidden');
        try {
            const response = await fetch(`/search?q=${encodeURIComponent(query)}`); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const students = await response.json(); displaySearchResults(students, query, resultsContainer);
        } catch (error) { console.error('Search error:', error); showSearchError(resultsContainer, 'Search failed.'); }
    }, 300));
    document.addEventListener('click', (e) => { if (!e.target.closest('#studentSearch') && !e.target.closest('#searchResults')) { resultsContainer.classList.add('hidden'); } });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { resultsContainer.classList.add('hidden'); searchInput.blur(); } });
}
function displaySearchResults(students, query, container) { if (students && students.length > 0) { container.innerHTML = students.map(student => ` <a href="/student/${student.id}" class="block p-3 border-b border-gray-200 hover:bg-gray-50 transition-colors"> <div class="flex items-center justify-between"> <div> <p class="font-semibold text-gray-800 text-sm">${student.name}</p> <p class="text-xs text-gray-600">${student.email}</p> <p class="text-xs text-gray-500">Class: ${student.className || 'N/A'} • Grade: ${student.overallGrade}%</p> </div> <i class="fas fa-chevron-right text-gray-400 text-xs"></i> </div> </a> `).join(''); container.classList.remove('hidden'); } else { showNoResults(container, query); } }
function showNoResults(container, query) { container.innerHTML = `<div class="p-4 text-center text-gray-500 text-sm"><i class="fas fa-search mr-2"></i>No results for "${query}"</div>`; container.classList.remove('hidden'); }
function showSearchError(container, message) { container.innerHTML = `<div class="p-4 text-center text-red-600 text-sm"><i class="fas fa-exclamation-triangle mr-2"></i>${message}</div>`; container.classList.remove('hidden'); }

// --- Grade/Score Update Functions ---
async function updateGrade(studentId, newGrade, event) {
    const inputElement = event ? event.target : null;
    let gradeNum;
    if (newGrade === null || String(newGrade).trim() === '') { showToast('Overall grade cannot be empty.', 'error'); if(inputElement) inputElement.focus(); return; }
    gradeNum = parseInt(newGrade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) { showToast('Overall grade must be 0-100.', 'error'); if(inputElement) inputElement.focus(); return; }
    if(inputElement) inputElement.classList.add('border-yellow-500');
    try {
        const response = await fetch('/update_grade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, new_grade: gradeNum }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.success) {
            showToast('Overall grade updated!', 'success');
            if(inputElement) {
                inputElement.classList.remove('border-yellow-500');
                inputElement.classList.add('border-green-500', 'bg-green-50/50');
                setTimeout(() => {
                    inputElement.classList.remove('border-green-500', 'bg-green-50/50');
                    // --- UPDATE ---
                    // Call helper functions to update row status AND page stats
                    updateStatusBadge(studentId, gradeNum);
                    updateClassViewStats(); // Recalculate summary cards
                    // --- END UPDATE ---
                }, 1000);
            }
            // --- REMOVED location.reload() ---
        } else { throw new Error(result.message || 'Update failed.'); }
    } catch (error) {
        console.error('Error updating overall grade:', error); showToast(`Error: ${error.message}`, 'error');
        if(inputElement) { inputElement.classList.remove('border-yellow-500'); inputElement.classList.add('border-red-500'); }
    }
}
async function updateAssignmentGrade(assignmentId, studentId, score, event, totalPoints) { const inputElement = event ? event.target : null; let scoreToSave = null; if (score !== null && String(score).trim() !== '') { const scoreNum = parseInt(score); if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > totalPoints) { showToast(`Score must be 0-${totalPoints} or empty.`, 'error'); if(inputElement) inputElement.focus(); return; } scoreToSave = scoreNum; } if(inputElement) { inputElement.classList.remove('border-red-500'); inputElement.classList.add('border-yellow-500'); } try { const response = await fetch('/update_assignment_grade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignment_id: assignmentId, student_id: studentId, grade: scoreToSave }) }); if (!response.ok) { const errorResult = await response.json().catch(() => ({})); throw new Error(errorResult.message || `Server error: ${response.status}`); } const result = await response.json(); if (result.success) { showToast('Score updated!', 'success'); if(inputElement) { inputElement.classList.remove('border-yellow-500'); inputElement.classList.add('border-green-500', 'bg-green-50/50'); setTimeout(() => { inputElement.classList.remove('border-green-500', 'bg-green-50/50'); updateAssessmentRow(inputElement.closest('tr'), scoreToSave, totalPoints); }, 1000); } } else { throw new Error(result.message || 'Update failed.'); } } catch (error) { console.error('Error updating score:', error); showToast(`Error: ${error.message}`, 'error'); if(inputElement) { inputElement.classList.remove('border-yellow-500'); inputElement.classList.add('border-red-500'); } } }

// --- Helpers for Dynamic Updates ---
function updateStatusBadge(studentId, grade) { const row = document.querySelector(`tr[data-student-id="${studentId}"]`); if (!row) return; const statusCell = row.querySelector('.status-cell'); if (!statusCell) return; const statusInfo = getStatusInfoFromGrade(grade); statusCell.innerHTML = `<span class="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.classes} status-badge">${statusInfo.text}</span>`; }
function updateAssessmentRow(tableRow, score, totalPoints) { if (!tableRow) return; const percentageCell = tableRow.querySelector('td:nth-child(3)'); const statusCell = tableRow.querySelector('td:nth-child(4)'); let percentage = null, statusInfo = { text: 'Not Graded', classes: 'text-gray-400' }, percentageHtml = '<span class="text-gray-400">-</span>'; if (score !== null && totalPoints > 0) { percentage = Math.round((score / totalPoints) * 100); const percentageClass = percentage >= 90 ? 'text-green-600' : percentage >= 70 ? 'text-blue-600' : percentage >= 60 ? 'text-yellow-600' : 'text-red-600'; percentageHtml = `<span class="font-medium ${percentageClass}">${percentage}%</span>`; statusInfo = getStatusInfoFromGrade(percentage); } if (percentageCell) percentageCell.innerHTML = percentageHtml; if (statusCell) statusCell.innerHTML = score !== null ? `<span class="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full status-badge ${statusInfo.classes}">${statusInfo.text}</span>` : '<span class="text-xs text-gray-400">Not Graded</span>'; }

// --- Add Assignment Form Listener ---
function updateClassViewStats() {
    // Find the stat elements
    const statAvgGradeEl = document.getElementById('stat-avg-grade');
    const statAtRiskEl = document.getElementById('stat-at-risk');
    // Find all grade inputs on the page
    const gradeInputs = document.querySelectorAll('.grade-input');

    // If we're not on the class-view page, these won't exist, so exit
    if (gradeInputs.length === 0 || (!statAvgGradeEl && !statAtRiskEl)) {
        // console.log("[Debug] Not on class view page, skipping stat update.");
        return;
    }

    let totalGrade = 0;
    let studentCount = 0;
    let atRiskCount = 0;

    // Loop through all inputs, read their value, and calculate stats
    gradeInputs.forEach(input => {
        const gradeNum = parseInt(input.value, 10);
        if (!isNaN(gradeNum)) {
            totalGrade += gradeNum;
            studentCount++;
            if (gradeNum < 60) {
                atRiskCount++;
            }
        }
    });

    const avgGrade = (studentCount > 0) ? Math.round(totalGrade / studentCount) : 0;

    // Update the HTML text
    if (statAvgGradeEl) {
        statAvgGradeEl.textContent = `${avgGrade}%`;
    }
    if (statAtRiskEl) {
        statAtRiskEl.textContent = atRiskCount;
    }
    console.log(`[Debug] Class stats updated: Avg: ${avgGrade}%, At Risk: ${atRiskCount}`);
}
function initializeAssignmentFormListener() { const addAssignmentForm = document.getElementById('addAssignmentForm'); if (addAssignmentForm) { addAssignmentForm.addEventListener('submit', async function(e) { console.log("Submit event fired for addAssignmentForm"); e.preventDefault(); console.log("Default submission prevented."); const submitButton = this.querySelector('button[type="submit"]'); const originalButtonText = submitButton.innerHTML; setLoadingState(submitButton, true, originalButtonText); const formData = new FormData(this); const assignmentData = { class_id: formData.get('class_id'), title: formData.get('title'), due_date: formData.get('due_date'), total_points: formData.get('total_points'), type: formData.get('type') }; if (!assignmentData.class_id || !assignmentData.title || !assignmentData.due_date || !assignmentData.total_points || !assignmentData.type) { showToast('Please fill out all fields.', 'error'); setLoadingState(submitButton, false, originalButtonText); return; } try { console.log("Calling addAssignmentOnServer with:", assignmentData); const success = await addAssignmentOnServer(assignmentData); if (success) { closeAddAssignmentModal(); showToast('Assignment created!', 'success'); setTimeout(() => location.reload(), 500); } } catch (error) { showToast(`Error: ${error.message || 'Could not create.'}`, 'error'); setLoadingState(submitButton, false, originalButtonText); } }); console.log("Assignment form listener attached."); } else { /* console.error("addAssignmentForm element not found on this page."); // Changed to log only when needed */ } }
async function addAssignmentOnServer(assignmentData) { try { const response = await fetch('/add_assignment', { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(assignmentData) }); if (!response.ok) { const errorResult = await response.json().catch(() => ({})); throw new Error(errorResult.message || `Server error: ${response.status}`); } const result = await response.json(); if (result.success) { console.log("Server responded with success:", result); return true; } else { console.log("Server responded with failure:", result); throw new Error(result.message || 'Failed on server.'); } } catch (error) { console.error('Error in addAssignmentOnServer:', error); throw error; } }

// --- Add Student Form Listener ---
function initializeAddStudentFormListener() {
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async function(e) {
            console.log("Submit event fired for addStudentForm"); e.preventDefault(); console.log("Default submission prevented for student form.");
            const submitButton = this.querySelector('button[type="submit"]'); const originalButtonText = submitButton ? submitButton.innerHTML : 'Add Student';
            setLoadingState(submitButton, true, originalButtonText);
            const formData = new FormData(this);
            const studentData = { name: formData.get('name'), email: formData.get('email'), classId: formData.get('classId'), parentPhone: formData.get('parentPhone') || null, skills: formData.get('skills') ? formData.get('skills').split(',').map(s => s.trim()).filter(s => s) : [] };
            if (!studentData.name || !studentData.email || !studentData.classId) { showToast('Please fill out Name, Email, and Class.', 'error'); setLoadingState(submitButton, false, originalButtonText); return; }
             if (!/\S+@\S+\.\S+/.test(studentData.email)) { showToast('Please enter a valid email address.', 'error'); setLoadingState(submitButton, false, originalButtonText); return; }
            try {
                console.log("Calling addStudentOnServer with:", studentData);
                const response = await fetch('/add_student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(studentData) });
                if (!response.ok) { const errorResult = await response.json().catch(() => ({})); throw new Error(errorResult.message || `Server error: ${response.status}`); }
                const result = await response.json();
                if (result.success) { closeAddStudentModal(); showToast('Student added successfully!', 'success'); setTimeout(() => location.reload(), 500); }
                else { throw new Error(result.message || 'Failed to add student on server.'); }
            } catch (error) { console.error('Error adding student:', error); showToast(`Error: ${error.message}`, 'error'); setLoadingState(submitButton, false, originalButtonText); }
        });
        console.log("Add Student form listener attached.");
    } else { /* console.log("addStudentForm element not found on this page."); */ }
}

// --- Edit Student Form Listener ---
function initializeEditStudentFormListener() {
    const editStudentForm = document.getElementById('editStudentForm');
    if (editStudentForm) {
        editStudentForm.addEventListener('submit', async function(e) {
            console.log("Submit event fired for editStudentForm"); e.preventDefault();
            const submitButton = this.querySelector('button[type="submit"]'); const originalButtonText = submitButton ? submitButton.innerHTML : 'Save Changes';
            setLoadingState(submitButton, true, originalButtonText);
            const studentId = this.dataset.studentId;
            if (!studentId) { showToast('Error: Student ID is missing.', 'error'); setLoadingState(submitButton, false, originalButtonText); return; }
            const formData = new FormData(this);
            const updatedData = { name: formData.get('name'), email: formData.get('email'), classId: formData.get('classId'), parentPhone: formData.get('parentPhone') || '', skills: formData.get('skills') ? formData.get('skills').split(',').map(s => s.trim()).filter(s => s) : [] };
            if (!updatedData.name || !updatedData.email || !updatedData.classId) { showToast('Name, Email, and Class are required.', 'error'); setLoadingState(submitButton, false, originalButtonText); return; }
             if (!/\S+@\S+\.\S+/.test(updatedData.email)) { showToast('Please enter a valid email address.', 'error'); setLoadingState(submitButton, false, originalButtonText); return; }
            try {
                console.log(`Calling /edit_student/${studentId} with:`, updatedData);
                const response = await fetch(`/edit_student/${studentId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
                if (!response.ok) { const errorResult = await response.json().catch(() => ({})); throw new Error(errorResult.message || `Server error: ${response.status}`); }
                const result = await response.json();
                if (result.success) { closeEditStudentModal(); showToast('Student details updated successfully!', 'success'); setTimeout(() => location.reload(), 500); }
                else { throw new Error(result.message || 'Failed to update student on server.'); }
            } catch (error) { console.error('Error updating student:', error); showToast(`Error: ${error.message}`, 'error'); setLoadingState(submitButton, false, originalButtonText); }
        });
        console.log("Edit Student form listener attached.");
    } else { /* console.log("editStudentForm element not found on this page."); */ }
}


// --- Utility Functions ---
function setLoadingState(element, isLoading, originalContent = 'Submit') { if(!element) return; if (isLoading) { element.disabled = true; element.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Working...`; } else { element.disabled = false; element.innerHTML = originalContent; } }
function showToast(message, type = 'success') { const toastContainer = document.getElementById('toast-container') || createToastContainer(); const toast = document.createElement('div'); const iconClass = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'; const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-600' : 'bg-blue-500'; toast.className = `p-3 rounded-lg shadow-md text-white text-sm ${bgColor} flex items-center transform transition-all duration-300 translate-x-full opacity-0 mb-2`; toast.innerHTML = `<i class="fas ${iconClass} mr-2"></i><span>${message}</span>`; toastContainer.prepend(toast); setTimeout(() => { toast.classList.remove('translate-x-full', 'opacity-0'); toast.classList.add('translate-x-0', 'opacity-100'); }, 10); setTimeout(() => { toast.classList.remove('translate-x-0', 'opacity-100'); toast.classList.add('opacity-0'); toast.addEventListener('transitionend', () => { if (toast.parentNode) toast.remove(); }); }, 4000); }
function createToastContainer() { let container = document.createElement('div'); container.id = 'toast-container'; container.className = 'fixed top-4 right-4 z-[100] w-64'; document.body.appendChild(container); return container; }
function getStatusInfoFromGrade(grade) { if (grade === null || grade === undefined || isNaN(grade)) return { text: 'N/A', classes: 'bg-gray-100 text-gray-800'}; grade = parseInt(grade); if (grade >= 90) return { text: 'Excellent', classes: 'bg-green-100 text-green-800'}; if (grade >= 70) return { text: 'Good', classes: 'bg-blue-100 text-blue-800'}; if (grade >= 60) return { text: 'Needs Help', classes: 'bg-yellow-100 text-yellow-800'}; return { text: 'At Risk', classes: 'bg-red-100 text-red-800'}; }
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func.apply(this, args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }

// --- Initialize Page-Specific Features ---
function initializePageSpecificFeatures() { document.querySelectorAll('.grade-input, .score-input').forEach(input => { input.addEventListener('focus', function() { this.select(); this.classList.remove('border-green-500', 'border-red-500', 'border-yellow-500', 'bg-green-50/50'); }); input.addEventListener('keydown', function(e) { if (e.key === 'Enter') this.blur(); }); }); }

// --- Modal Functions (Add/Edit Student, Reset, View Details) ---
function showAddAssignmentModal() { console.log("showAddAssignmentModal function called."); const modal = document.getElementById('addAssignmentModal'); const dialog = document.getElementById('addAssignmentDialog'); if (!modal || !dialog) { console.error("Modal element (#addAssignmentModal) not found!"); return; } console.log("Modal and Dialog elements found."); modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); dialog.classList.remove('scale-95', 'opacity-0'); }, 10); }
function closeAddAssignmentModal() { console.log("closeAddAssignmentModal function called."); const modal = document.getElementById('addAssignmentModal'); const dialog = document.getElementById('addAssignmentDialog'); const form = document.getElementById('addAssignmentForm'); if(modal && dialog) { modal.classList.add('opacity-0'); dialog.classList.add('scale-95', 'opacity-0'); setTimeout(() => { modal.classList.add('hidden'); if (form) form.reset(); }, 300); } }
function initializeResetModalListeners() { const modal = document.getElementById('resetModal'); if (modal) { modal.addEventListener('click', function(e) { if (e.target === this) hideResetConfirmation(); }); /* Escape listener handled globally */ } }
function showResetConfirmation() { const modal = document.getElementById('resetModal'); if (modal) modal.classList.remove('hidden'); }
function hideResetConfirmation() { const modal = document.getElementById('resetModal'); if (modal) modal.classList.add('hidden'); }
async function resetAllData() { console.log("Attempting to reset data..."); const resetButton = document.querySelector('#resetModal button:last-child'); const originalText = resetButton ? resetButton.innerHTML : 'Yes, Reset'; if(resetButton) setLoadingState(resetButton, true, originalText); try { const response = await fetch('/reset_data', { method: 'POST'}); if (!response.ok) throw new Error(`Server error: ${response.status}`); const data = await response.json(); if (data.success) { showToast('All data has been reset successfully!', 'success'); hideResetConfirmation(); setTimeout(() => window.location.href = '/', 1000); } else { throw new Error(data.message || 'Reset failed on server.'); } } catch (error) { console.error('Error resetting data:', error); showToast(`Error: ${error.message}`, 'error'); if(resetButton) setLoadingState(resetButton, false, originalText); } }
function closeModal(modalId = 'studentModal') { const modal = document.getElementById(modalId); if (modal) { modal.classList.add('hidden','opacity-0'); const dialog = modal.querySelector('[id$="Dialog"]'); if(dialog) dialog.classList.add('scale-95','opacity-0'); } }

// Show/Close Add Student Modal
function showAddStudentModal() { console.log("showAddStudentModal called."); const modal = document.getElementById('addStudentModal'); const dialog = document.getElementById('addStudentDialog'); if (!modal || !dialog) { console.error("Add Student modal elements not found!"); return; } modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); dialog.classList.remove('scale-95', 'opacity-0'); }, 10); }
function closeAddStudentModal() { console.log("closeAddStudentModal called."); const modal = document.getElementById('addStudentModal'); const dialog = document.getElementById('addStudentDialog'); const form = document.getElementById('addStudentForm'); if(modal && dialog) { modal.classList.add('opacity-0'); dialog.classList.add('scale-95', 'opacity-0'); setTimeout(() => { modal.classList.add('hidden'); if (form) form.reset(); }, 300); } }

// Show/Close Edit Student Modal
async function showEditStudentModal(studentId) {
    console.log(`showEditStudentModal called for ${studentId}`);
    const modal = document.getElementById('editStudentModal'); const dialog = document.getElementById('editStudentDialog'); const form = document.getElementById('editStudentForm');
    if (!modal || !dialog || !form) { console.error("Edit Student modal elements not found!"); return; }
    form.reset(); form.dataset.studentId = ''; document.getElementById('editStudentModalTitle').textContent = 'Loading Student...';
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); dialog.classList.remove('scale-95', 'opacity-0'); }, 10);
    try {
        const response = await fetch(`/get_student_details?student_id=${studentId}`); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const student = await response.json(); if (student.error) throw new Error(student.error);
        form.dataset.studentId = student.id; document.getElementById('editStudentModalTitle').textContent = `Edit ${student.name}`;
        document.getElementById('editStudentName').value = student.name || ''; document.getElementById('editStudentEmail').value = student.email || '';
        document.getElementById('editStudentClass').value = student.classId || ''; document.getElementById('editStudentParentPhone').value = student.parentPhone || '';
        document.getElementById('editStudentSkills').value = (student.skills || []).join(', ');
        document.getElementById('editStudentUidDisplay').textContent = student.uid || 'N/A'; document.getElementById('editStudentRollDisplay').textContent = student.rollNumber || 'N/A';
    } catch (error) { console.error('Error fetching student details for edit:', error); showToast(`Error loading data: ${error.message}`, 'error'); closeEditStudentModal(); }
}
function closeEditStudentModal() { console.log("closeEditStudentModal called."); const modal = document.getElementById('editStudentModal'); const dialog = document.getElementById('editStudentDialog'); const form = document.getElementById('editStudentForm'); if(modal && dialog) { modal.classList.add('opacity-0'); dialog.classList.add('scale-95', 'opacity-0'); setTimeout(() => { modal.classList.add('hidden'); if (form) { form.reset(); form.dataset.studentId = '';} }, 300); } }

// Consolidated Modal Listeners (Backdrop + Escape Key)
function initializeStudentModalListeners(){
     const modals = [ { id: 'studentModal', closeFn: () => closeModal('studentModal') }, { id: 'addStudentModal', closeFn: closeAddStudentModal }, { id: 'editStudentModal', closeFn: closeEditStudentModal }, { id: 'addAssignmentModal', closeFn: closeAddAssignmentModal } ];
     modals.forEach(mInfo => { const modal = document.getElementById(mInfo.id); if(modal) modal.addEventListener('click', function(e) { if (e.target === this) mInfo.closeFn(); }); });
     document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { modals.forEach(mInfo => { const modal = document.getElementById(mInfo.id); if(modal && !modal.classList.contains('hidden')) mInfo.closeFn(); }); const resetModal = document.getElementById('resetModal'); if(resetModal && !resetModal.classList.contains('hidden') && typeof hideResetConfirmation === 'function') hideResetConfirmation(); } });
     console.log("Modal backdrop/escape listeners attached.");
}

async function viewStudentDetails(studentId) { const modal = document.getElementById('studentModal'); const modalContent = document.getElementById('modalContent'); const modalTitle = document.getElementById('modalStudentName'); if (!modal || !modalContent || !modalTitle) { console.error("Student detail modal elements not found."); return; } modalTitle.textContent = 'Loading...'; modalContent.innerHTML = '<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-500"></i></div>'; modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); /* dialog has no scale-95 here? */}, 10); try { const response = await fetch(`/get_student_details?student_id=${studentId}`); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const student = await response.json(); if (student.error) throw new Error(student.error); modalTitle.textContent = student.name; const statusInfo = getStatusInfoFromGrade(student.overallGrade); modalContent.innerHTML = ` <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> <div class="border-b pb-2"> <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label> <p class="mt-1 text-sm text-gray-800">${student.email || '-'}</p> </div> <div class="border-b pb-2"> <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Class</label> <p class="mt-1 text-sm text-gray-800">${student.className || 'N/A'}</p> </div> <div class="border-b pb-2"> <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">UID</label> <p class="mt-1 text-sm text-gray-800">${student.uid || '-'}</p> </div> <div class="border-b pb-2"> <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</label> <p class="mt-1 text-sm text-gray-800">${student.rollNumber || '-'}</p> </div> <div class="border-b pb-2"> <label class_name="block text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Grade</label> <p class="mt-1 text-lg font-semibold ${statusInfo.classes.replace('bg-', 'text-').split(' ')[1]}">${student.overallGrade}%</p> </div> <div class="border-b pb-2"> <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label> <span class="mt-1 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.classes}">${statusInfo.text}</span> </div> <div class="border-b pb-2 md:col-span-2"> <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Last Milestone</label> <p class="mt-1 text-sm text-gray-800">${student.lastMilestone || '-'}</p> </div> <div class="border-b pb-2 md:col-span-2"> <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</label> <div class="mt-1 flex flex-wrap gap-2"> ${student.skills && student.skills.length > 0 ? student.skills.map(skill => `<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">${skill}</span>`).join('') : '<span class="text-xs text-gray-500">No skills listed.</span>' } </div> </div> </div>`; } catch (error) { console.error('Error loading student details:', error); modalContent.innerHTML = `<div class="text-center p-8 text-red-600"><i class="fas fa-exclamation-triangle mr-2"></i>Error loading details.</div>`; } }


// --- Dropdown Functions ---
function toggleDropdown(assignmentId) {
    console.log(`[DEBUG] toggleDropdown called for ID: ${assignmentId}`);
    const dropdown = document.getElementById(`dropdown-${assignmentId}`);
    if (dropdown) {
        console.log("[DEBUG] Dropdown element found:", dropdown);
        const intendedToShow = dropdown.classList.contains('hidden');
        closeDropdowns(assignmentId);
        dropdown.classList.toggle('hidden');
        console.log(`[DEBUG] Dropdown ${assignmentId} hidden state is now: ${dropdown.classList.contains('hidden')}`);
        if (intendedToShow && dropdown.classList.contains('hidden')) { console.error(`[DEBUG] Failed to remove 'hidden' class from dropdown ${assignmentId}`); }
    } else { console.error(`[DEBUG] Dropdown element with ID dropdown-${assignmentId} not found!`); }
}
function closeDropdowns(excludeId = null) {
    // console.log(`[DEBUG] closeDropdowns called, excluding: ${excludeId}`); // Less noise
    document.querySelectorAll('[id^="dropdown-"]').forEach(d => {
        const shouldExclude = excludeId && d.id === `dropdown-${excludeId}`;
        if (!d.classList.contains('hidden') && !shouldExclude) { d.classList.add('hidden'); }
    });
}
function initializeDropdownListeners() {
     document.addEventListener('click', function(event) {
        const clickedToggle = event.target.closest('[onclick^="toggleDropdown"]');
        const clickedDropdown = event.target.closest('[id^="dropdown-"]');
        if (!clickedToggle && !clickedDropdown) { closeDropdowns(); }
     });
     console.log("[DEBUG] Global click listener for closing dropdowns attached.");
}

// --- Placeholder for unimplemented features ---
function showNotImplementedToast(feature = 'This feature') { if (typeof showToast === 'function') { showToast(`${feature} is not implemented yet.`, 'info'); } else { console.warn(`${feature} not implemented. (showToast missing)`); alert(`${feature} not implemented.`); } }

// --- Delete Student Function ---
async function deleteStudent(studentId) {
     closeEditStudentModal(); // Close edit modal first if open
    if (confirm(`Are you absolutely sure you want to delete student ${studentId}? This cannot be undone and will remove all associated grades.`)) {
         console.log(`Attempting to delete student: ${studentId}`);
         try {
             const response = await fetch(`/delete_student/${studentId}`, { method: 'POST' });
             if (!response.ok) { const errorResult = await response.json().catch(() => ({})); throw new Error(errorResult.message || `Server error: ${response.status}`); }
             const result = await response.json();
             if (result.success) { showToast(result.message || 'Student deleted!', 'success'); setTimeout(() => window.location.href = '/students', 1000); } // Redirect to students list
             else { throw new Error(result.message || 'Failed to delete student.'); }
         } catch (error) { console.error('Error deleting student:', error); showToast(`Error: ${error.message}`, 'error'); }
    }
}


// --- Global Exports ---
window.updateGrade = updateGrade;
window.updateAssignmentGrade = updateAssignmentGrade;
window.showToast = showToast;
window.viewStudentDetails = viewStudentDetails;
window.closeModal = closeModal;
window.showResetConfirmation = showResetConfirmation;
window.hideResetConfirmation = hideResetConfirmation;
window.resetAllData = resetAllData;
window.showAddStudentModal = showAddStudentModal;
window.closeAddStudentModal = closeAddStudentModal;
window.showEditStudentModal = showEditStudentModal;
window.closeEditStudentModal = closeEditStudentModal;
window.deleteStudent = deleteStudent;
window.toggleDropdown = toggleDropdown;
window.closeDropdowns = closeDropdowns;
window.editAssignment = (assignmentId) => { closeDropdowns(); showNotImplementedToast(`Edit Assignment ${assignmentId}`); };
window.deleteAssignment = (assignmentId) => {
    closeDropdowns();
    if (confirm(`Are you sure you want to delete assignment ${assignmentId}? This action cannot be undone.`)) {
         const showToastFunc = typeof showToast === 'function' ? showToast : (msg, type) => console[type === 'error' ? 'error' : 'log'](msg);
         fetch('/delete_assignment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignment_id: assignmentId }) })
         .then(response => response.ok ? response.json() : response.json().then(err => { throw new Error(err.message || 'Server error') }))
         .then(result => {
             if (result.success) {
                 showToastFunc('Assignment deleted.', 'success');
                 const cardToRemove = document.querySelector(`[onclick="toggleDropdown('${assignmentId}')"]`)?.closest('.assignment-card');
                 if (cardToRemove) { cardToRemove.remove(); if (!document.querySelector('.assignments-grid > .assignment-card')) { location.reload(); } } else { location.reload(); }
             } else { throw new Error(result.message || 'Failed to delete.'); }
         })
         .catch(error => { console.error('Error deleting assignment:', error); showToastFunc(`Error: ${error.message}`, 'error'); });
    }
};
window.viewAssignmentGrades = (assignId, classId) => {
     closeDropdowns();
     if(classId) {
         // --- FIX: Link to /gradebook with pre-selected values ---
         window.location.href = `/gradebook?assignment_id=${assignId}&class_id=${classId}`;
     } else {
         if(typeof showToast === 'function') showToast('Cannot determine class for assignment.', 'error');
         else console.error('Cannot determine class for assignment.');
     }
};
window.showNotImplementedToast = showNotImplementedToast;

