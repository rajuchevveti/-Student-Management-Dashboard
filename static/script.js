// Initialize all page functionality when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded. Initializing scripts..."); // Debug log
    initializeSidebarToggle();
    initializeSearchFunctionality();
    initializePageSpecificFeatures(); // Calls specific page inits
    initializeAssignmentFormListener(); // << UPDATED for multiple classes
    initializeResetModalListeners();
    initializeStudentModalListeners();
    initializeDropdownListeners();
    initializeAddStudentFormListener();
    initializeEditStudentFormListener(); // Contains skill-saving fix
    initializeImportStudentsFormListener();
    initializeBulkStudentActions(); // This initializes it for the /students page
    initializeClassManagement();

    // Debug: Log counts after initialization (optional)
    // console.log("Edit student buttons found:", document.querySelectorAll('[onclick*="showEditStudentModal"]').length);
    // console.log("Delete student buttons found:", document.querySelectorAll('[onclick*="deleteStudent"]').length);
});

// --- Utility Functions ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function fetchWithErrorHandling(url, options = {}) {
    try {
        // Default to JSON content type if not FormData
        const headers = { ...options.headers };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }

        const response = await fetch(url, {
            ...options,
            headers: headers
        });
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try { // Try to get more info from response body
                const errBody = await response.json();
                errorMsg = errBody.message || errBody.error || errorMsg;
            } catch(e) { /* Ignore if body isn't JSON */ }
            throw new Error(errorMsg);
        }
        // Check content type before parsing JSON
        const contentType = response.headers.get("content-type");
         if (contentType && contentType.includes("application/json")) {
             return await response.json();
         } else {
             console.warn(`Response from ${url} was not JSON. Returning raw response.`);
             return response; // Return the raw response for non-JSON cases
         }

    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        // Throw the error so the calling function's catch block handles it
        throw error;
    }
}
async function fetchWithErrorHandling_Robust(url, options = {}) {
    const defaultHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const mergedHeaders = { ...defaultHeaders, ...options.headers };
    if (options.body instanceof FormData) delete mergedHeaders['Content-Type'];
    try {
        const response = await fetch(url, { ...options, headers: mergedHeaders });
        const contentType = response.headers.get("content-type");
        let responseData;
        if (contentType && contentType.includes("application/json")) {
            responseData = await response.json();
        } else {
            const textResponse = await response.text();
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}. Response: ${textResponse}`);
            console.warn(`Unexpected non-JSON response from ${url}. CT: ${contentType}`);
            return { success: true, data: textResponse };
        }
        if (!response.ok) {
            const errorMessage = responseData.message || responseData.error || `HTTP error! Status: ${response.status}`;
            throw new Error(errorMessage);
        }
        return responseData;
    } catch (error) {
        console.error(`Robust Fetch error for ${url}:`, error);
        throw error;
    }
}


function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const iconClass = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-600' : 'bg-blue-500';
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-lg shadow-md text-white text-sm ${bgColor} flex items-center transform transition-all duration-300 translate-x-full opacity-0 mb-2`;
    toast.innerHTML = `<i class="fas ${iconClass} mr-2"></i><span>${message}</span>`;
    toastContainer.prepend(toast);
    setTimeout(() => { toast.classList.remove('translate-x-full', 'opacity-0'); toast.classList.add('translate-x-0', 'opacity-100'); }, 10);
    setTimeout(() => {
        toast.classList.remove('translate-x-0', 'opacity-100'); toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => { if(toast.parentNode) toast.remove(); }, { once: true });
    }, 4000);
}

function createToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-[100] w-64 space-y-2';
        document.body.appendChild(container);
    }
    return container;
}


function setLoadingState(element, isLoading, originalContent = null) {
    if (!element) return;
    const spinnerIcon = '<i class="fas fa-spinner fa-spin mr-2"></i>';
    if (isLoading) {
        if (!element.dataset.originalContent) element.dataset.originalContent = element.innerHTML;
        element.disabled = true;
        // Check if icon exists, replace it
        const icon = element.querySelector('i.fas');
        if (icon && !icon.classList.contains('fa-spinner')) {
             element.dataset.originalIcon = icon.className;
             icon.className = 'fas fa-spinner fa-spin mr-2';
             // Keep text content
             const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
             if (textNode) textNode.textContent = ' Working...';
        } else if (!icon) {
             element.innerHTML = `${spinnerIcon}Working...`;
        }
    } else {
        element.disabled = false;
        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        } else if (originalContent) {
             element.innerHTML = originalContent;
        } else {
            // Restore icon if it was saved
            const icon = element.querySelector('i.fas');
            if (icon && element.dataset.originalIcon) {
                icon.className = element.dataset.originalIcon;
                delete element.dataset.originalIcon;
                 const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                 if(textNode) textNode.textContent = ' Submit'; // Fallback text
            } else {
                 element.textContent = 'Submit'; // Fallback
            }
        }
    }
}

function getStatusInfoFromGrade(grade) {
    if (grade === null || grade === undefined || isNaN(grade)) { return { text: 'N/A', classes: 'bg-gray-100 text-gray-800' }; }
    grade = parseInt(grade);
    if (grade >= 90) return { text: 'Excellent', classes: 'bg-green-100 text-green-800' };
    if (grade >= 70) return { text: 'Good', classes: 'bg-blue-100 text-blue-800' };
    if (grade >= 60) return { text: 'Needs Help', classes: 'bg-yellow-100 text-yellow-800' };
    return { text: 'At Risk', classes: 'bg-red-100 text-red-800' };
}

function showNotImplementedToast(feature = 'This feature') { showToast(`${feature} is not implemented.`, 'info'); }

// --- Sidebar ---
function initializeSidebarToggle() {
    const sidebar = document.getElementById('sidebar'), toggleBtn = document.getElementById('sidebarToggle'), toggleIcon = document.getElementById('toggleIcon'), overlay = document.getElementById('overlay');
    if (!sidebar || !toggleBtn || !toggleIcon || !overlay) { console.warn("Sidebar elements missing."); return; }
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) { sidebar.classList.add('collapsed'); toggleIcon.className = 'fas fa-bars'; } else { sidebar.classList.remove('collapsed'); toggleIcon.className = 'fas fa-times'; if (window.innerWidth <= 768) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; } }
    toggleBtn.addEventListener('click', () => { const willBeCollapsed = !sidebar.classList.contains('collapsed'); sidebar.classList.toggle('collapsed'); toggleIcon.className = willBeCollapsed ? 'fas fa-bars' : 'fas fa-times'; if (window.innerWidth <= 768) { overlay.classList.toggle('active', !willBeCollapsed); document.body.style.overflow = willBeCollapsed ? '' : 'hidden'; } localStorage.setItem('sidebarCollapsed', willBeCollapsed); });
    overlay.addEventListener('click', () => { sidebar.classList.add('collapsed'); toggleIcon.className = 'fas fa-bars'; overlay.classList.remove('active'); document.body.style.overflow = ''; localStorage.setItem('sidebarCollapsed', true); });
    document.querySelectorAll('.nav-item').forEach(item => { item.addEventListener('click', () => { if (window.innerWidth <= 768 && !sidebar.classList.contains('collapsed')) { sidebar.classList.add('collapsed'); toggleIcon.className = 'fas fa-bars'; overlay.classList.remove('active'); document.body.style.overflow = ''; localStorage.setItem('sidebarCollapsed', true); } }); });
    window.addEventListener('resize', () => { if (window.innerWidth > 768) { overlay.classList.remove('active'); document.body.style.overflow = ''; } else if (!sidebar.classList.contains('collapsed')) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sidebar.classList.contains('collapsed')) { sidebar.classList.add('collapsed'); toggleIcon.className = 'fas fa-bars'; overlay.classList.remove('active'); document.body.style.overflow = ''; localStorage.setItem('sidebarCollapsed', true); } });
}

// --- Search ---
function initializeSearchFunctionality() {
    const searchInput = document.getElementById('studentSearch'); const resultsContainer = document.getElementById('searchResults'); if (!searchInput || !resultsContainer) return;
    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim(); resultsContainer.innerHTML = '';
        if (query.length < 2) { resultsContainer.classList.add('hidden'); return; }
        resultsContainer.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Searching...</div>'; resultsContainer.classList.remove('hidden');
        try { const response = await fetch(`/search?q=${encodeURIComponent(query)}`); if (!response.ok) throw new Error(`HTTP error ${response.status}`); const students = await response.json(); displaySearchResults(students, query, resultsContainer); }
        catch (error) { console.error('Search failed:', error); showSearchError(resultsContainer, 'Search failed.'); }
    }, 300));
    document.addEventListener('click', (e) => { if (!e.target.closest('#studentSearch') && !e.target.closest('#searchResults')) { resultsContainer.classList.add('hidden'); } });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { resultsContainer.classList.add('hidden'); searchInput.blur(); } });
}
function displaySearchResults(students, query, container) { if (students && students.length > 0) { container.innerHTML = students.map(s => `<a href="/student/${s.id}" class="block p-3 border-b hover:bg-gray-50"><div class="flex items-center justify-between"><div><p class="font-semibold text-gray-800 text-sm">${s.name}</p><p class="text-xs text-gray-600">${s.email}</p><p class="text-xs text-gray-500">Class: ${s.className||'N/A'} • Grade: ${s.overallGrade||'N/A'}%</p></div><i class="fas fa-chevron-right text-gray-400 text-xs"></i></div></a>`).join(''); } else { showNoResults(container, query); } container.classList.remove('hidden'); }
function showNoResults(container, query) { container.innerHTML = `<div class="p-4 text-center text-gray-500 text-sm"><i class="fas fa-search mr-2"></i>No results for "${query}"</div>`; container.classList.remove('hidden');}
function showSearchError(container, message) { container.innerHTML = `<div class="p-4 text-center text-red-600 text-sm"><i class="fas fa-exclamation-triangle mr-2"></i>${message}</div>`; container.classList.remove('hidden');}

// --- Grade/Score Update Functions ---
async function updateGrade(studentId, newGrade, event) {
    const inputElement = event ? event.target : null; let gradeNum;
    if (newGrade === null || String(newGrade).trim() === '') { showToast('Grade cannot be empty.', 'error'); if(inputElement) inputElement.focus(); return; }
    gradeNum = parseInt(newGrade); if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) { showToast('Grade must be 0-100.', 'error'); if(inputElement) inputElement.focus(); return; }
    if (inputElement) { inputElement.classList.add('border-yellow-500'); inputElement.disabled = true; }
    try {
        const result = await fetchWithErrorHandling('/update_grade', { method: 'POST', body: JSON.stringify({ student_id: studentId, new_grade: gradeNum }) });
        if (result.success) {
            showToast('Grade updated!', 'success');
            if (inputElement) {
                inputElement.classList.remove('border-yellow-500'); inputElement.classList.add('border-green-500','bg-green-50/50');
                // Update status badge first
                updateStatusBadge(studentId, gradeNum);
                // Then update summary stats
                if (window.location.pathname.startsWith('/class/')) {
                    updateClassSummaryStats(); // Call summary update here
                }
                // Then remove green highlight after a delay
                setTimeout(() => { inputElement.classList.remove('border-green-500','bg-green-50/50'); }, 1000);
            } else {
                 // If input element not found, still try to update stats if on class page
                 if (window.location.pathname.startsWith('/class/')) {
                    updateClassSummaryStats();
                 }
            }
        } else { throw new Error(result.message || 'Update failed.'); }
    } catch (error) { console.error('Error updating grade:', error); showToast(`Error: ${error.message}`, 'error'); if(inputElement){ inputElement.classList.remove('border-yellow-500'); inputElement.classList.add('border-red-500'); } }
    finally { if (inputElement) inputElement.disabled = false; }
}
async function updateAssignmentGrade(assignmentId, studentId, score, event, totalPoints) {
    const inputElement = event ? event.target : null; let scoreToSave = null;
    if (score !== null && String(score).trim() !== '') {
        const scoreNum = parseInt(score); if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > totalPoints) { showToast(`Score must be 0-${totalPoints} or empty.`, 'error'); if(inputElement) inputElement.focus(); return; }
        scoreToSave = scoreNum;
    }
    if (inputElement) { inputElement.classList.remove('border-red-500'); inputElement.classList.add('border-yellow-500'); inputElement.disabled = true; }
    try {
        const result = await fetchWithErrorHandling('/update_assignment_grade', { method: 'POST', body: JSON.stringify({ assignment_id: assignmentId, student_id: studentId, grade: scoreToSave }) });
        if (result.success) {
            showToast('Score updated!', 'success');
            if (inputElement) {
                inputElement.classList.remove('border-yellow-500'); inputElement.classList.add('border-green-500','bg-green-50/50');
                setTimeout(() => { inputElement.classList.remove('border-green-500','bg-green-50/50'); updateAssessmentRow(inputElement.closest('tr'), scoreToSave, totalPoints); }, 1000);
            }
        } else { throw new Error(result.message || 'Update failed.'); }
    } catch (error) { console.error('Error updating score:', error); showToast(`Error: ${error.message}`, 'error'); if(inputElement){ inputElement.classList.remove('border-yellow-500'); inputElement.classList.add('border-red-500'); } }
    finally { if (inputElement) inputElement.disabled = false; }
}
function updateStatusBadge(studentId, grade) {
     const row = document.querySelector(`tr[data-student-id="${studentId}"]`); if (!row) return;
     const statusCell = row.querySelector('.status-cell'); if (!statusCell) return;
     const statusInfo = getStatusInfoFromGrade(grade);
     statusCell.innerHTML = `<span class="px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full ${statusInfo.classes} status-badge">${statusInfo.text}</span>`;
     if (row.dataset.status !== undefined) row.dataset.status = statusInfo.text;
}
function updateAssessmentRow(tableRow, score, totalPoints) {
     if (!tableRow) return;
     const percentageCell = tableRow.querySelector('.percentage-cell'); const statusCell = tableRow.querySelector('.status-cell');
     let statusInfo = getStatusInfoFromGrade(null); let percentageHtml = '<span class="text-gray-400 text-sm">-</span>';
     const maxPoints = (typeof totalPoints === 'number' && totalPoints > 0) ? totalPoints : null;
     if (score !== null && maxPoints) {
         const percentage = Math.round((score / maxPoints) * 100); statusInfo = getStatusInfoFromGrade(percentage);
         const color = percentage >= 90 ? 'green' : percentage >= 70 ? 'blue' : percentage >= 60 ? 'yellow' : 'red';
         percentageHtml = `<span class="font-medium text-sm text-${color}-600">${percentage}%</span>`;
     }
     if (percentageCell) percentageCell.innerHTML = percentageHtml;
     if (statusCell) statusCell.innerHTML = (score !== null) ? `<span class="px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full status-badge ${statusInfo.classes}">${statusInfo.text}</span>` : '<span class="text-xs text-gray-400">Not Graded</span>';
}

// --- !! UPDATED updateClassSummaryStats !! ---
function updateClassSummaryStats() {
    console.log("Updating class summary stats...");
    // Use the IDs from class_view.html
    const averageGradeDisplay = document.getElementById('stat-avg-grade');
    const studentsAtRiskDisplay = document.getElementById('stat-at-risk');
    // Use the ID added to class_view.html
    const tableBody = document.getElementById('classStudentTableBody');

    // Check if elements exist before proceeding
    if (!averageGradeDisplay) { console.warn("Average grade display element ('stat-avg-grade') not found."); return; }
    if (!studentsAtRiskDisplay) { console.warn("Students at risk display element ('stat-at-risk') not found."); return; }
    if (!tableBody) { console.warn("Class student table body ('classStudentTableBody') not found for summary stats."); return; } // Keep this check

    const gradeInputs = tableBody.querySelectorAll('.grade-input');

    if (gradeInputs.length === 0) {
        averageGradeDisplay.textContent = 'N/A';
        studentsAtRiskDisplay.textContent = '0';
        console.log("No grade inputs found in table body.");
        return;
    }

    let totalGrade = 0, validCount = 0, atRiskCount = 0;
    gradeInputs.forEach(input => {
        const gradeVal = input.value;
        if (gradeVal !== null && gradeVal !== '' && !isNaN(gradeVal)) {
            const gradeNum = parseInt(gradeVal, 10);
            if (gradeNum >= 0 && gradeNum <= 100) {
                totalGrade += gradeNum;
                validCount++;
                if (gradeNum < 60) { // Assuming < 60 is 'At Risk' based on getStatusInfoFromGrade
                   atRiskCount++;
                }
            }
        }
    });

    const avg = validCount > 0 ? Math.round(totalGrade / validCount) : 'N/A';
    averageGradeDisplay.textContent = avg === 'N/A' ? 'N/A' : `${avg}%`;
    studentsAtRiskDisplay.textContent = atRiskCount;
    console.log(`Class Stats updated: Avg=${avg}, AtRisk=${atRiskCount}`);
}
// --- !! END UPDATED !! ---


// --- Page-Specific Initializers ---
function initializePageSpecificFeatures() {
    document.querySelectorAll('.grade-input, .score-input').forEach(input => {
        input.addEventListener('focus', function() { this.select(); this.classList.remove('border-green-500', 'border-red-500', 'border-yellow-500', 'bg-green-50/50'); });
        input.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); } });
    });
    const currentPath = window.location.pathname;
    if (document.getElementById('gradeDistributionChart')) {
        console.log("Init Dashboard...");
    } else if (currentPath.startsWith('/class/')) {
        initializeClassPage();
        // initializeBulkStudentActions(); // <-- MOVED inside initializeClassPage
    } else if (window.location.pathname.startsWith('/assignments')) {
        initializeAssignmentsPageFilters(); // << UPDATED to use this function name
    } else if (document.getElementById('searchInput') && currentPath.includes('/students')) {
        initializeStudentPageFilters();
        initializeBulkStudentActions(); // Only init bulk actions on /students page
    } else if (document.getElementById('gradebookFilterForm')) {
        initializeGradebookPage(); // UPDATED: Calls the new function
        initializeGradebookSearch(); // NEW: Initialize gradebook search
        initializeStatusLegendTooltips(); // NEW: Initialize status legend tooltips
    }
}

// --- Page-Specific Filter/Setup Functions ---

// Students Page Filters (students.html)
function initializeStudentPageFilters() {
    console.log("Initializing student page filters...");
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const gradeFilter = document.getElementById('gradeFilter');
    const sectionFilter = document.getElementById('sectionFilter');
    const campusFilter = document.getElementById('campusFilter');
    const studentTableBody = document.getElementById('studentTableBody');
    if (!studentTableBody) { console.warn("Student table body not found."); return; }
    if (!searchInput || !statusFilter || !gradeFilter || !sectionFilter || !campusFilter) { console.warn("Student filter elements not all found."); }
    const studentRows = Array.from(studentTableBody.querySelectorAll('.student-row'));

    window.filterStudentsGlobally = function filterStudents() {
        console.log("Filtering students...");
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const statusValue = statusFilter ? statusFilter.value : 'all';
        const gradeValue = gradeFilter ? gradeFilter.value : 'all';
        const sectionValue = sectionFilter ? sectionFilter.value : 'all';
        const campusValue = campusFilter ? campusFilter.value : 'all';
        let visibleCount = 0;
        studentRows.forEach(row => {
            const name = row.dataset.name || ''; const email = row.dataset.email || ''; const uid = row.dataset.uid || ''; const status = row.dataset.status || 'N/A';
            const gradeName = row.dataset.gradeName || ''; const sectionName = row.dataset.sectionName || ''; const campusName = row.dataset.campusName || '';
            
            // On /students page, we filter. On /class/ page, we don't.
            // But this function is only called on /students page, so filters are fine.
            const matchesSearch = searchTerm === '' || name.includes(searchTerm) || email.includes(searchTerm) || uid.includes(searchTerm);
            const matchesStatus = statusValue === 'all' || status === statusValue;
            const matchesGrade = gradeValue === 'all' || gradeName === gradeValue.toLowerCase();
            const matchesSection = sectionValue === 'all' || sectionName === sectionValue.toLowerCase();
            const matchesCampus = campusValue === 'all' || campusName === campusValue.toLowerCase();
            const isVisible = matchesSearch && matchesStatus && matchesGrade && matchesSection && matchesCampus;
            
            row.style.display = isVisible ? '' : 'none'; 
            if (isVisible) visibleCount++;
        });
        const noStudentsRow = studentTableBody.querySelector('tr:not(.student-row)');
        if (noStudentsRow) noStudentsRow.style.display = (visibleCount === 0) ? '' : 'none';
        if (typeof updateBulkActionsVisibility === 'function') updateBulkActionsVisibility();
        console.log(`Filtering done. Visible: ${visibleCount}`);
    }
    if(searchInput) searchInput.addEventListener('input', debounce(window.filterStudentsGlobally, 300));
    if(statusFilter) statusFilter.addEventListener('change', window.filterStudentsGlobally);
    if(gradeFilter) gradeFilter.addEventListener('change', window.filterStudentsGlobally);
    if(sectionFilter) sectionFilter.addEventListener('change', window.filterStudentsGlobally);
    if(campusFilter) campusFilter.addEventListener('change', window.filterStudentsGlobally);
    window.filterStudentsGlobally(); // Run on load
}


// --- !! FIXED: Assignments Page Filters (assignments.html) !! ---
function initializeAssignmentsPageFilters() {
    console.log("Initializing assignments page filters...");
    
    const searchInput = document.getElementById('searchAssignments');
    const classFilter = document.getElementById('classFilter');
    const typeFilter = document.getElementById('typeFilter');
    const assignmentsGrid = document.querySelector('.assignments-grid, .assignments-stack');
    
    if (!assignmentsGrid) { 
        console.error("Assignments container (.assignments-grid or .assignments-stack) not found."); 
        return; 
    }

    console.log("Found assignments grid, refreshing class filter...");

    // Refresh the class filter dropdown
    if(classFilter) {
        refreshSelectWithOptions(classFilter, '/api/get_classes', 'Error loading classes');
    }

    // Select cards using the specific class
    const assignmentCards = Array.from(assignmentsGrid.querySelectorAll('.assignment-card'));
    console.log(`Found ${assignmentCards.length} assignment cards`);

    function filterAssignments() {
        console.log("Filtering assignments...");
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedClassId = classFilter ? classFilter.value : 'all';
        const typeValue = typeFilter ? typeFilter.value.toLowerCase() : 'all';

        console.log(`Filters - Search: "${searchTerm}", Class: ${selectedClassId}, Type: ${typeValue}`);

        let visibleCount = 0;

        assignmentCards.forEach((card, index) => {
            const title = card.dataset.title?.toLowerCase() || '';
            const assignedClassIds = (card.dataset.classIds || '').split(',').filter(id => id);
            const cardType = card.dataset.type?.toLowerCase() || '';

            const matchesSearch = searchTerm === '' || title.includes(searchTerm);
            const matchesClass = selectedClassId === 'all' || assignedClassIds.includes(selectedClassId);
            const matchesType = typeValue === 'all' || cardType === typeValue;

            const isVisible = matchesSearch && matchesClass && matchesType;
            
            card.style.display = isVisible ? '' : 'none'; 
            if (isVisible) visibleCount++;
        });

        const emptyState = assignmentsGrid.querySelector('div:not(.assignment-card)');
        if (emptyState) {
            emptyState.style.display = (visibleCount === 0) ? '' : 'none';
        }
        
        console.log(`Filtering complete. Visible count: ${visibleCount}`);
    }

    // Add event listeners
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterAssignments, 300));
    }
    if (classFilter) {
        classFilter.addEventListener('change', filterAssignments);
    }
    if (typeFilter) {
        typeFilter.addEventListener('change', filterAssignments);
    }

    // *** FIX: Don't run filter immediately. Wait for dropdown to populate first ***
    // Run initial filter only after a longer delay to ensure dropdown is populated
    setTimeout(() => {
        // Check if class filter has been populated (has more than just "All Classes" option)
        if (classFilter && classFilter.options.length > 1) {
            console.log("Class filter populated, running initial filter");
            filterAssignments();
        } else {
            console.log("Class filter not yet populated, showing all assignments");
            // If filter isn't ready, just show all assignments
            assignmentCards.forEach(card => {
                card.style.display = '';
            });
        }
    }, 1000); // Longer delay to ensure dropdown is populated
}
// --- !! END FIXED !! ---

// --- **** UPDATED: initializeClassPage **** ---
function initializeClassPage() { 
    console.log("Class view page init..."); 
    updateClassSummaryStats();
    initializeBulkStudentActions(); // <-- **** ADDED THIS CALL ****
}
// --- **** END UPDATED **** ---

// --- !! UPDATED initializeGradebookPage !! ---
function initializeGradebookPage() {
    console.log("Initializing Gradebook page...");
    const form = document.getElementById('gradebookFilterForm');
    const assignmentSelect = document.getElementById('assignment_id');
    const classSelect = document.getElementById('class_id');

    if (!form || !assignmentSelect || !classSelect) {
        console.error("Gradebook filter elements not found.");
        return;
    }

    let allClassData = []; // To store fetched class data

    // 1. Fetch all classes on page load
    fetchWithErrorHandling('/api/get_classes')
        .then(classes => {
            if (!Array.isArray(classes)) {
                throw new Error("Invalid class data received from API.");
            }
            allClassData = classes; // Store class data
            console.log(`Fetched ${allClassData.length} classes for gradebook.`);
            // Optionally: Pre-populate class dropdown if an assignment is already selected on load
            const initialAssignmentId = assignmentSelect.value;
            if (initialAssignmentId) {
                updateClassDropdown(initialAssignmentId); // Call the update function
                // Preserve initial class selection if valid for the assignment
                const urlParams = new URLSearchParams(window.location.search);
                const initialClassId = urlParams.get('class_id');
                // Check if the option *exists* in the (now filtered) dropdown
                if (initialClassId && classSelect.querySelector(`option[value="${initialClassId}"]`)) {
                    classSelect.value = initialClassId;
                } else if (classSelect.options.length === 2) {
                     // If only one class is relevant (plus the prompt), auto-select it
                     classSelect.value = classSelect.options[1].value;
                     // Auto-submit if auto-selection happens
                     if (assignmentSelect.value && classSelect.value) form.submit();
                }
            } else {
                 // Ensure class dropdown is disabled if no assignment selected initially
                 classSelect.disabled = true;
                 classSelect.innerHTML = '<option value="" disabled selected>-- Select Assignment First --</option>';
            }
        })
        .catch(error => {
            console.error("Error fetching class data for gradebook:", error);
            showToast("Error loading class list.", "error");
            classSelect.innerHTML = '<option value="" disabled selected>Error loading classes</option>';
            classSelect.disabled = true;
            assignmentSelect.disabled = true; // Disable assignment select too if classes fail
        });

    // 2. Function to update the class dropdown based on selected assignment
    const updateClassDropdown = (selectedAssignmentId) => {
        const selectedAssignmentOption = assignmentSelect.querySelector(`option[value="${selectedAssignmentId}"]`);
        if (!selectedAssignmentOption) {
            console.warn("Selected assignment option not found.");
             classSelect.innerHTML = '<option value="" disabled selected>-- Select Class --</option>';
             classSelect.disabled = true;
            return;
        }

        const classIdsString = selectedAssignmentOption.dataset.classIds || '';
        const relevantClassIds = classIdsString.split(',').filter(id => id); // Get IDs for this assignment

        // Clear current class options (keeping the first placeholder)
        classSelect.innerHTML = '<option value="" disabled selected>-- Select Class --</option>';

        if (relevantClassIds.length === 0) {
            classSelect.disabled = true; // Disable if no relevant classes
            showToast("This assignment isn't assigned to any classes.", "info");
            return; // Exit if no classes are linked
        }

        // Filter allClassData to get only relevant classes
        const relevantClasses = allClassData
            .filter(cls => relevantClassIds.includes(cls.id))
            .sort((a, b) => { // Sort relevant classes for display
                const textA = `${a.name} - ${a.section} (${a.campus || 'N/A'})`;
                const textB = `${b.name} - ${b.section} (${b.campus || 'N/A'})`;
                return textA.localeCompare(textB);
            });

        // Populate the dropdown
        relevantClasses.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.id;
            option.textContent = `${cls.name} - ${cls.section} (${cls.campus || 'N/A'})`;
            classSelect.appendChild(option);
        });

        classSelect.disabled = false; // Enable the class dropdown
        classSelect.value = ""; // Reset to prompt

        // If only one class is relevant, auto-select it and submit
        if (relevantClasses.length === 1) {
            
            // Get the class_id from the URL, if it's already there
            const urlParams = new URLSearchParams(window.location.search);
            const classIdFromUrl = urlParams.get('class_id');

            // Set the value in the dropdown
            classSelect.value = relevantClasses[0].id;

            // **** FIX ****
            // Only auto-submit if the URL *doesn't* already have this class_id.
            // This prevents the reload loop.
            if (classIdFromUrl !== relevantClasses[0].id) {
                console.log("Auto-selecting and submitting for single-class assignment...");
                setTimeout(() => {
                    if (assignmentSelect.value && classSelect.value) form.submit();
                }, 100);
            }
        }
    };

    // 3. Add listener to Assignment dropdown
    assignmentSelect.addEventListener('change', (event) => {
        console.log("Assignment changed:", event.target.value);
        updateClassDropdown(event.target.value);
        // Do NOT submit form here, wait for class selection
    });

    // 4. Add listener to Class dropdown (NOW handles form submission)
    classSelect.addEventListener('change', () => {
        if (assignmentSelect.value && classSelect.value) {
            console.log("Class selected, submitting form...");
            form.submit(); // Submit the form when a valid class is chosen
        }
    });
}
// --- !! END UPDATED !! ---

// --- Gradebook Search Functionality ---
function initializeGradebookSearch() {
    const searchInput = document.getElementById('gradebookStudentSearch');
    const clearButton = document.getElementById('clearSearch');
    const studentRows = document.querySelectorAll('.gradebook-student-row');
    const studentCountElement = document.getElementById('studentCount');
    
    if (!searchInput || !studentRows.length) return;

    function filterStudents() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        let visibleCount = 0;

        studentRows.forEach(row => {
            const studentName = row.dataset.studentName || '';
            const studentEmail = row.dataset.studentEmail || '';
            
            const matchesSearch = searchTerm === '' || 
                                studentName.includes(searchTerm) || 
                                studentEmail.includes(searchTerm);
            
            row.style.display = matchesSearch ? '' : 'none';
            if (matchesSearch) visibleCount++;
        });

        // Update student count
        if (studentCountElement) {
            studentCountElement.textContent = visibleCount;
        }

        // Show/hide clear button
        if (clearButton) {
            clearButton.classList.toggle('hidden', searchTerm === '');
        }
    }

    // Event listeners
    searchInput.addEventListener('input', debounce(filterStudents, 300));
    
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            filterStudents();
            searchInput.focus();
        });
    }

    // Handle Escape key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            filterStudents();
        }
    });

    // Initial filter to set correct count
    filterStudents();
}

// --- Status Legend Tooltips ---
function initializeStatusLegendTooltips() {
    // Add tooltips to status badges in the table
    const statusBadges = document.querySelectorAll('.status-badge');
    
    statusBadges.forEach(badge => {
        const statusText = badge.textContent.trim();
        let tooltipText = '';
        
        switch(statusText) {
            case 'Excellent':
                tooltipText = '90-100%';
                break;
            case 'Good':
                tooltipText = '70-89%';
                break;
            case 'Needs Help':
                tooltipText = '60-69%';
                break;
            case 'At Risk':
                tooltipText = '0-59%';
                break;
            default:
                tooltipText = 'Not graded';
        }
        
        badge.title = tooltipText;
        badge.setAttribute('data-tooltip', tooltipText);
    });
    
    // Add click handler to status legend items to show detailed info
    const statusLegendItems = document.querySelectorAll('.status-legend-item');
    statusLegendItems.forEach(item => {
        item.addEventListener('click', function() {
            const range = this.dataset.range;
            const status = this.dataset.status;
            showToast(`${status}: ${range}`, 'info');
        });
    });

    // Add hover effects to legend
    const legendItems = document.querySelectorAll('.flex.items-center.gap-1');
    legendItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.cursor = 'pointer';
            this.style.opacity = '0.8';
        });
        item.addEventListener('mouseleave', function() {
            this.style.opacity = '1';
        });
    });
}

// --- Modal Functions ---
function closeModal(modalId = 'studentModal') {
    const modal = document.getElementById(modalId); if (!modal) return;
    modal.classList.add('opacity-0'); const dialog = modal.querySelector('.bg-white.rounded-xl') || modal.children[0]; if (dialog) dialog.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden'); const form = modal.querySelector('form'); if (form) { form.reset(); form.querySelectorAll('[id$="Error"], .form-error').forEach(el => { el.textContent = ''; el.classList.add('hidden'); }); }
        if(modalId === 'addAssignmentModal') deselectAllClasses();
        if(modalId === 'importStudentsModal') { const fn = document.getElementById('csvFileName'); if(fn){ fn.textContent='No file chosen'; fn.classList.add('text-gray-400'); fn.classList.remove('text-gray-700'); } const fi = document.getElementById('student_csv'); if(fi) fi.value=''; }
    }, 300);
}
function showModal(modalId) {
    const modal = document.getElementById(modalId); const dialog = modal ? (modal.querySelector('.bg-white.rounded-xl') || modal.children[0]) : null;
    if (!modal || !dialog) { console.error(`Modal elements missing for ID: ${modalId}`); showToast('Error opening modal.', 'error'); return; }
    const form = modal.querySelector('form'); if (form) form.reset();
    modal.classList.remove('hidden'); requestAnimationFrame(() => { modal.classList.remove('opacity-0'); dialog.classList.remove('scale-95', 'opacity-0'); });
}
function showAddAssignmentModal() {
    const dueDateInput = document.getElementById('assignmentDueDate');
    if (dueDateInput) { try { const t = new Date(); t.setDate(t.getDate() + 1); dueDateInput.value = t.toISOString().split('T')[0]; } catch(e) { console.error("Could not set date", e); } }
    // Refresh checkboxes before showing
    const checkboxList = document.getElementById('assignmentClassList');
    if(checkboxList) refreshAssignmentClassCheckboxes(checkboxList);
    deselectAllClasses();
    showModal('addAssignmentModal');
}
function closeAddAssignmentModal() { closeModal('addAssignmentModal'); }
async function showAddStudentModal() {
    const select = document.getElementById('addStudentClass'); // Use correct ID from base.html
    if(select) await refreshSelectWithOptions(select, '/api/get_classes', 'Error loading classes');
    showModal('addStudentModal');
}
function closeAddStudentModal() { closeModal('addStudentModal'); }

async function refreshSelectWithOptions(selectElement, apiUrl, errorMessage = 'Error loading', loadingElementId = null) {
     if (!selectElement) { console.error("Target select element missing."); return; }
     const loadingSpinner = loadingElementId ? document.getElementById(loadingElementId) : null;
     const previouslySelectedValue = selectElement.value;
     selectElement.disabled = true; if (loadingSpinner) loadingSpinner.classList.remove('hidden');
     selectElement.innerHTML = '<option value="" disabled selected>Loading...</option>';
     try {
         const response = await fetch(apiUrl + '?nocache=' + new Date().getTime());
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         const optionsData = await response.json(); if (!Array.isArray(optionsData)) throw new Error('Invalid data');

         // Clear loading
         selectElement.innerHTML = '';

         // Add "All" or "-- Select --" option
         const isFilter = ['classFilter', 'classFilterStudents', 'sectionFilter', 'campusFilter', 'gradeFilter'].includes(selectElement.id);
         const isGradebookClassSelect = selectElement.id === 'class_id';

         if (isFilter) {
             const allOpt = document.createElement('option');
             allOpt.value = 'all';
             if (selectElement.id.includes('class')) allOpt.textContent = 'All Classes';
             else if (selectElement.id.includes('Section')) allOpt.textContent = 'All Sections';
             else if (selectElement.id.includes('Campus')) allOpt.textContent = 'All Campuses';
             else if (selectElement.id.includes('Grade')) allOpt.textContent = 'All Grades';
             else allOpt.textContent = 'All';
             selectElement.appendChild(allOpt);
         } else if (!isGradebookClassSelect) { // Add prompt for non-filter, non-gradebook class selects (e.g., modals)
             const promptOpt = document.createElement('option');
             promptOpt.value = "";
             promptOpt.textContent = "-- Select --";
             promptOpt.disabled = true;
             selectElement.appendChild(promptOpt);
         }
         // Gradebook class select gets its prompt added dynamically by initializeGradebookPage

         // Populate options
         optionsData.sort((a, b) => {
             const textA = (a.name && a.section) ? `${a.name} - ${a.section} (${a.campus || 'N/A'})` : a; // Include campus
             const textB = (b.name && b.section) ? `${b.name} - ${b.section} (${b.campus || 'N/A'})` : b; // Include campus
             return textA.localeCompare(textB);
         }).forEach(item => {
             const option = document.createElement('option');
             if (typeof item === 'object' && item.id && item.name && item.section) { // Class object
                 option.value = item.id; option.textContent = `${item.name} - ${item.section} (${item.campus || 'N/A'})`;
             } else { // Simple string (for non-class filters if any)
                 option.value = item; option.textContent = item;
             }
             selectElement.appendChild(option);
         });

         // Restore previous selection or default
         if (previouslySelectedValue && selectElement.querySelector(`option[value="${previouslySelectedValue}"]`)) {
             selectElement.value = previouslySelectedValue;
         } else if (isFilter) {
             selectElement.value = "all"; // Default filters to "All"
         } else if (!isGradebookClassSelect){
             selectElement.value = ""; // Default modals to prompt
         }
         // Gradebook class select value is handled by initializeGradebookPage

     } catch (error) { console.error(`Error refreshing ${selectElement.id}:`, error); showToast(errorMessage, 'error'); selectElement.innerHTML = `<option value="" disabled selected>Error</option>`;
     } finally {
         // Don't re-enable gradebook class select here if it should be disabled
         if (selectElement.id !== 'class_id' || selectElement.options.length > 1) { // Check if options were added besides prompt
            selectElement.disabled = false;
         }
         if (loadingSpinner) loadingSpinner.classList.add('hidden');
     }
}


function showImportStudentsModal() { showModal('importStudentsModal'); }
function closeImportStudentsModal() { closeModal('importStudentsModal'); }

async function showEditStudentModal(studentId) {
    const modal = document.getElementById('editStudentModal'); const form = document.getElementById('editStudentForm'); if (!modal || !form) { console.error("Edit modal elements missing"); return; }
    form.reset(); form.dataset.studentId = ''; document.getElementById('editStudentModalTitle').textContent = 'Loading...';
    document.getElementById('uidDuplicateError')?.classList.add('hidden'); document.getElementById('rollNumberDuplicateError')?.classList.add('hidden');
    document.querySelectorAll('#editStudentModal .skill-slider').forEach(s => { s.value = 1; const v = document.getElementById(s.id.replace('Rating','Value')); if(v) v.textContent = '1'; });
    const classSelect = document.getElementById('editStudentClass'); if(classSelect) await refreshSelectWithOptions(classSelect, '/api/get_classes', 'Error loading classes');
    showModal('editStudentModal');
    try {
        const response = await fetch(`/get_student_details?student_id=${studentId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`); const student = await response.json(); if (student.error) throw new Error(student.error);
        form.dataset.studentId = student.id; document.getElementById('editStudentModalTitle').textContent = `Edit ${student.name}`;
        form.elements['name'].value = student.name || ''; form.elements['email'].value = student.email || ''; form.elements['classId'].value = student.classId || '';
        form.elements['uid'].value = student.uid || ''; form.elements['rollNumber'].value = student.rollNumber || ''; form.elements['parentPhone'].value = student.parentPhone || '';
        const campusSelect = form.elements['campus']; if(campusSelect) campusSelect.value = student.campus || '';

        // Populate skill sliders
        if (student.skills && typeof student.skills === 'object') {
            for (const skillName in student.skills) {
                const rating = student.skills[skillName] || 0;
                // Need to find the slider by its data-skill-name
                const slider = form.querySelector(`input[data-skill-name="${skillName}"]`);
                if (slider) {
                    slider.value = rating;
                    // Update the text display next to the slider
                    const valueDisplay = document.getElementById(slider.id.replace('Rating', 'Value'));
                    if (valueDisplay) {
                        valueDisplay.textContent = rating;
                    }
                }
            }
        } else {
             // Reset all sliders to 1 if no skill data
             form.querySelectorAll('.skill-slider').forEach(slider => {
                 slider.value = 1;
                 const valueDisplay = document.getElementById(slider.id.replace('Rating', 'Value'));
                 if (valueDisplay) valueDisplay.textContent = '1';
             });
        }
    } catch (error) { console.error('Error fetching student details:', error); showToast(`Error loading data: ${error.message}`, 'error'); closeEditStudentModal(); }
}

function closeEditStudentModal() { closeModal('editStudentModal'); }

// --- !! UPDATED showManageClassesModal !! ---
async function showManageClassesModal() {
    const classesList = document.getElementById('classes-list'); if (!classesList) { console.error("Classes list element missing"); return; }
    classesList.innerHTML = '<p class="text-center text-gray-500">Loading...</p>'; showModal('manage-classes-modal');
    try {
        const response = await fetch('/api/get_classes');
        if (!response.ok) throw new Error(`HTTP ${response.status}`); const classes = await response.json();
        classesList.innerHTML = '';
        if (classes && classes.length > 0) {
            classes.sort((a,b) => (a.name+a.section).localeCompare(b.name+b.section)).forEach(cls => {
                const div = document.createElement('div');
                // Add responsive classes: flex-col on small, md:flex-row on medium+, md:items-center, gap-2
                div.className = 'flex flex-col md:flex-row justify-between md:items-center p-2 border-b gap-2';
                // Add text-sm, break-words for text span. Add flex-shrink-0 and w-full/md:w-auto to button div
                div.innerHTML = `
                    <span class="text-sm break-words">${cls.name} - ${cls.section} (${cls.campus||'N/A'}, Students: ${cls.studentCount||0})</span>
                    <div class="flex-shrink-0 w-full md:w-auto flex items-center gap-2">
                        <button onclick="showEditClassModal('${cls.id}')" class="w-1/2 md:w-auto bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 text-xs">Edit</button>
                        <button onclick="deleteClass('${cls.id}')" class="w-1/2 md:w-auto bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs ${cls.studentCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${cls.studentCount > 0 ? 'disabled title="Cannot delete class with students"' : ''}>Delete</button>
                    </div>`;
                classesList.appendChild(div);
            });
        } else { classesList.innerHTML = '<p class="text-center text-gray-500">No classes found.</p>'; }
    } catch (error) { console.error('Error fetching classes:', error); classesList.innerHTML = '<p class="text-center text-red-600">Error loading classes.</p>'; showToast('Failed to load classes.', 'error'); }
}
// --- !! END UPDATED !! ---

function closeManageClassesModal() { closeModal('manage-classes-modal'); }
function showAddClassModal() {
    const form = document.getElementById('class-form'); const title = document.getElementById('class-form-title'); if(!form || !title) return;
    title.textContent = 'Add Class'; form.reset(); document.getElementById('class-id').value = ''; document.getElementById('class-form-error').classList.add('hidden');
    document.getElementById('class-color').value = ''; document.querySelectorAll('input[name="color_option"]').forEach(r=>r.checked=false);
    showModal('class-form-modal'); form.onsubmit = (e) => { e.preventDefault(); addClass(); };
}
async function showEditClassModal(classId) {
    const form = document.getElementById('class-form'); const title = document.getElementById('class-form-title'); const errorEl = document.getElementById('class-form-error'); if(!form || !title || !errorEl) return;
    title.textContent = 'Loading...'; form.reset(); errorEl.classList.add('hidden'); showModal('class-form-modal');
    try {
        const response = await fetch(`/api/get_class/${classId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json(); if (data.error) throw new Error(data.error);
        title.textContent = 'Edit Class'; document.getElementById('class-id').value = data.id; form.elements['name'].value = data.name||''; form.elements['section'].value = data.section||''; form.elements['campus'].value = data.campus||'';
        const colorVal = data.color||''; document.getElementById('class-color').value = colorVal; const radio = form.querySelector(`input[name="color_option"][value="${colorVal}"]`); if(radio) radio.checked = true;
        form.onsubmit = (e) => { e.preventDefault(); editClass(classId); };
    } catch (error) { console.error('Error fetching class:', error); errorEl.textContent = 'Error loading details.'; errorEl.classList.remove('hidden'); showToast('Failed to load details.', 'error'); setTimeout(closeClassFormModal, 1500); }
}
function closeClassFormModal() { closeModal('class-form-modal'); }
function showResetConfirmation() { showModal('resetModal'); }
function hideResetConfirmation() { closeModal('resetModal'); }

// --- Modal Listeners ---
function initializeStudentModalListeners() {
     const modals = [ { id: 'studentModal', closeFn: () => closeModal('studentModal') }, { id: 'addStudentModal', closeFn: closeAddStudentModal }, { id: 'editStudentModal', closeFn: closeEditStudentModal }, { id: 'addAssignmentModal', closeFn: closeAddAssignmentModal }, { id: 'importStudentsModal', closeFn: closeImportStudentsModal }, { id: 'manage-classes-modal', closeFn: closeManageClassesModal }, { id: 'class-form-modal', closeFn: closeClassFormModal }, { id: 'resetModal', closeFn: hideResetConfirmation } ];
     modals.forEach(mInfo => { const modal = document.getElementById(mInfo.id); if (modal) { modal.addEventListener('click', function(e) { if (e.target === this) mInfo.closeFn(); }); } });
     document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { modals.forEach(mInfo => { const modal = document.getElementById(mInfo.id); if (modal && !modal.classList.contains('hidden')) mInfo.closeFn(); }); } });
}

// --- Form Listeners ---

// --- !! UPDATED: Assignment Form Listener !! ---
function initializeAssignmentFormListener() {
    const form = document.getElementById('addAssignmentForm');
    if (!form) { console.warn("Add assignment form not found."); return; }
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = btn.innerHTML;
        setLoadingState(btn, true, originalBtnHTML);

        // Get all checked class IDs from the checkboxes
        const classCheckboxes = document.querySelectorAll('#assignmentClassList .assignment-class-checkbox:checked');
        const selectedClassIds = Array.from(classCheckboxes).map(cb => cb.value);

        const errorEl = document.getElementById('classSelectionError'); // Error message element
        if (selectedClassIds.length === 0) {
            if(errorEl) errorEl.classList.remove('hidden'); // Show error if no class selected
            showToast('Please select at least one class.', 'error');
            setLoadingState(btn, false, originalBtnHTML);
            return;
        } else {
            if(errorEl) errorEl.classList.add('hidden'); // Hide error if classes are selected
        }

        const formData = {
            class_ids: selectedClassIds, // Use the new key 'class_ids' and send the array
            title: document.getElementById('assignmentTitle').value,
            due_date: document.getElementById('assignmentDueDate').value,
            total_points: document.getElementById('assignmentPoints').value,
            type: document.getElementById('assignmentType').value
        };

        try {
            const result = await fetchWithErrorHandling('/add_assignment', {
                method: 'POST',
                body: JSON.stringify(formData) // Send as JSON
            });
            if (result.success) {
                showToast(result.message || 'Assignment created successfully!', 'success');
                closeAddAssignmentModal();
                // Reload assignments page if currently on it
                if (window.location.pathname.startsWith('/assignments')) {
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    // Optionally, refresh parts of other pages if needed
                }
            } else {
                throw new Error(result.message || 'Failed to create assignment.');
            }
        } catch (error) {
            console.error('Error adding assignment:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingState(btn, false, originalBtnHTML);
        }
    });
}
// --- !! END UPDATED !! ---

function initializeAddStudentFormListener() {
    const form = document.getElementById('addStudentForm');
    if (!form) { console.warn("Add student form not found."); return; }
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = btn.innerHTML;
        setLoadingState(btn, true, originalBtnHTML);
        const errorEl = document.getElementById('addStudentFormError');
        if(errorEl) errorEl.classList.add('hidden');

        const formData = {
            name: form.elements['name'].value,
            email: form.elements['email'].value,
            classId: form.elements['classId'].value,
            uid: form.elements['uid'].value,
            rollNumber: form.elements['rollNumber'].value,
            parentPhone: form.elements['parentPhone'].value,
            campus: form.elements['campus'].value
        };

        try {
            const result = await fetchWithErrorHandling('/add_student', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            if (result.success) {
                showToast('Student added successfully!', 'success');
                closeAddStudentModal();
                if (window.location.pathname.startsWith('/students') || window.location.pathname.startsWith('/class/')) {
                    setTimeout(() => window.location.reload(), 1000);
                }
            } else {
                throw new Error(result.message || 'Failed to add student.');
            }
        } catch (error) {
            console.error('Error adding student:', error);
            if(errorEl) { errorEl.textContent = error.message; errorEl.classList.remove('hidden'); }
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingState(btn, false, originalBtnHTML);
        }
    });
}

function initializeEditStudentFormListener() {
    const form = document.getElementById('editStudentForm');
    if (!form) { console.warn("Edit student form not found."); return; }
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const studentId = form.dataset.studentId;
        if (!studentId) {
            showToast('Error: No student ID found.', 'error');
            return;
        }
        const btn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = btn.innerHTML;
        setLoadingState(btn, true, originalBtnHTML);
        const errorEl = document.getElementById('editStudentFormError');
        if(errorEl) errorEl.classList.add('hidden');

        // --- Logic to read skill sliders ---
        const skills = {};
        const skillSliders = form.querySelectorAll('.skill-slider');
        skillSliders.forEach(slider => {
            const skillName = slider.dataset.skillName;
            if (skillName) {
                skills[skillName] = parseInt(slider.value, 10);
            }
        });
        // --- End skill logic ---

        const formData = {
            name: form.elements['name'].value,
            email: form.elements['email'].value,
            classId: form.elements['classId'].value,
            uid: form.elements['uid'].value,
            rollNumber: form.elements['rollNumber'].value,
            parentPhone: form.elements['parentPhone'].value,
            campus: form.elements['campus'].value,
            skills: skills // Attach the skills object
        };

        try {
            const validation = await validateUniqueFields(studentId, formData.uid, formData.rollNumber);
            if(validation.has_duplicates) {
                if(validation.duplicate_uid) document.getElementById('uidDuplicateError').textContent = `UID used by ${validation.duplicate_uid}`;
                if(validation.duplicate_roll) document.getElementById('rollNumberDuplicateError').textContent = `Roll No. used by ${validation.duplicate_roll}`;
                throw new Error("UID or Roll Number already exists.");
            }

            const result = await fetchWithErrorHandling(`/edit_student/${studentId}`, {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            if (result.success) {
                showToast('Student updated successfully!', 'success');
                closeEditStudentModal();
                // Use reload to see changes
                setTimeout(() => window.location.reload(), 1000);
            } else {
                throw new Error(result.message || 'Failed to update student.');
            }
        } catch (error) {
            console.error('Error updating student:', error);
            if(errorEl) { errorEl.textContent = error.message; errorEl.classList.remove('hidden'); }
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingState(btn, false, originalBtnHTML);
        }
    });
}


function initializeImportStudentsFormListener() {
    const form = document.getElementById('importStudentsForm');
    const fileInput = document.getElementById('studentCsvFile'); // Use new ID from students.html
    const fileNameDisplay = document.getElementById('csvFileName');

    if (!form || !fileInput || !fileNameDisplay) {
         console.warn("Import form elements missing (form, file input, or file name display).");
         // Check for the other modal's elements
         const oldFileInput = document.getElementById('student_csv');
         if(oldFileInput) {
             oldFileInput.addEventListener('change', () => {
                 const oldDisplay = document.getElementById('csvFileName');
                 if (oldDisplay) oldDisplay.textContent = oldFileInput.files[0] ? oldFileInput.files[0].name : 'No file chosen';
             });
         }
         return;
    }

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = fileInput.files[0].name;
            fileNameDisplay.classList.remove('text-gray-400');
            fileNameDisplay.classList.add('text-gray-700');
        } else {
            fileNameDisplay.textContent = 'No file chosen';
            fileNameDisplay.classList.add('text-gray-400');
            fileNameDisplay.classList.remove('text-gray-700');
        }
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (fileInput.files.length === 0) {
            showToast('Please select a CSV file to upload.', 'error');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = btn.innerHTML;
        setLoadingState(btn, true, originalBtnHTML);

        const formData = new FormData();
        formData.append('student_csv', fileInput.files[0]);

        try {
            // Use fetchWithErrorHandling as it's designed to handle FormData
            const result = await fetchWithErrorHandling('/upload_students_csv', {
                method: 'POST',
                body: formData // No Content-Type header needed
            });

            if (result.success) {
                showToast(result.message || 'Import successful!', 'success');
                closeImportStudentsModal();
                // Reload the page to show new students and import summary
                setTimeout(() => window.location.reload(), 1000);
            } else {
                // Server returned a JSON error
                throw new Error(result.message || 'Import failed. Please check the file.');
            }
        } catch (error) {
            // Catch network errors or non-JSON errors
            console.error('Error importing students:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingState(btn, false, originalBtnHTML);
            // Clear file input
            fileInput.value = '';
            fileNameDisplay.textContent = 'No file chosen';
            fileNameDisplay.classList.add('text-gray-400');
            fileNameDisplay.classList.remove('text-gray-700');
        }
    });
}


function initializeResetModalListeners() {
    const btn = document.getElementById('confirmReset');
    if(btn) btn.addEventListener('click', resetAllData);
}

// --- Class Management Functions ---
function initializeClassManagement() {
    const manageBtn = document.getElementById('manageClassesButton'); if(manageBtn) manageBtn.addEventListener('click', showManageClassesModal);
    const addBtn = document.getElementById('add-class-btn'); if(addBtn) addBtn.addEventListener('click', showAddClassModal);
    document.querySelectorAll('input[name="color_option"]').forEach(radio => { radio.addEventListener('change', () => { const target = document.getElementById(radio.dataset.colorTarget); if(target) target.value = radio.value; }); });
}
async function addClass() {
    const form = document.getElementById('class-form'); const btn = form.querySelector('button[type="submit"]'); const err = document.getElementById('class-form-error'); const original = btn? btn.innerHTML : 'Save';
    if(btn) setLoadingState(btn, true, original); if(err) err.classList.add('hidden');
    const data = { name: form.elements['name'].value.trim(), section: form.elements['section'].value.trim(), campus: form.elements['campus'].value.trim(), color: form.elements['color'].value };
    if (!data.name || !data.section || !data.campus || !data.color) { if(err){ err.textContent = 'All fields required.'; err.classList.remove('hidden'); } showToast('All fields required.', 'error'); if(btn) setLoadingState(btn, false, original); return; }
    try {
        const result = await fetchWithErrorHandling('/add_class', { method: 'POST', body: JSON.stringify(data) });
        if (result.success) { closeClassFormModal(); await showManageClassesModal(); showToast('Class added!', 'success'); await refreshAllClassSelects(); }
        else { throw new Error(result.message || 'Error adding.'); }
    } catch (error) { console.error('Add class error:', error); if(err){ err.textContent = error.message; err.classList.remove('hidden'); } showToast(error.message, 'error'); }
    finally { if(btn) setLoadingState(btn, false, original); }
}
async function editClass(classId) {
    const form = document.getElementById('class-form'); const btn = form.querySelector('button[type="submit"]'); const err = document.getElementById('class-form-error'); const original = btn? btn.innerHTML : 'Save';
    if(btn) setLoadingState(btn, true, original); if(err) err.classList.add('hidden');
    const data = { name: form.elements['name'].value.trim(), section: form.elements['section'].value.trim(), campus: form.elements['campus'].value.trim(), color: form.elements['color'].value };
    if (!data.name || !data.section || !data.campus || !data.color) { if(err){ err.textContent = 'All fields required.'; err.classList.remove('hidden'); } showToast('All fields required.', 'error'); if(btn) setLoadingState(btn, false, original); return; }
    try {
        const result = await fetchWithErrorHandling(`/edit_class/${classId}`, { method: 'POST', body: JSON.stringify(data) });
        if (result.success) { closeClassFormModal(); await showManageClassesModal(); showToast('Class updated!', 'success'); await refreshAllClassSelects(); }
        else { throw new Error(result.message || 'Error updating.'); }
    } catch (error) { console.error('Edit class error:', error); if(err){ err.textContent = error.message; err.classList.remove('hidden'); } showToast(error.message, 'error'); }
    finally { if(btn) setLoadingState(btn, false, original); }
}
async function deleteClass(classId) {
    if (!confirm('Delete this class? This will also delete assignments linked ONLY to this class. This cannot be undone.')) return;
    const btn = document.querySelector(`button[onclick="deleteClass('${classId}')"]`); const original = btn? btn.innerHTML : 'Delete';
    if(btn) setLoadingState(btn, true, original);
    try {
        const result = await fetchWithErrorHandling(`/delete_class/${classId}`, { method: 'POST' });
        if (result.success) { await showManageClassesModal(); showToast('Class deleted!', 'success'); await refreshAllClassSelects(); }
        else { throw new Error(result.message || 'Error deleting.'); }
    } catch (error) { console.error('Delete class error:', error); showToast(error.message, 'error'); }
    finally { if(btn) setLoadingState(btn, false, original); }
}


// --- **** UPDATED: Bulk Student Actions - FIXED VERSION **** ---
function initializeBulkStudentActions() {
    const bulkActionContainer = document.getElementById('bulkActionContainer');
    const deleteSelectedButton = document.getElementById('deleteSelectedButton');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    // Find the correct table body ID
    const studentTableBody = document.getElementById('studentTableBody') || document.getElementById('classStudentTableBody');
    
    const selectedCountText = document.getElementById('selectedCountText');

    if (!bulkActionContainer || !deleteSelectedButton || !selectAllCheckbox || !studentTableBody || !selectedCountText) {
         console.warn("Bulk action elements not fully found. Skipping bulk actions."); 
         return;
    }

    const studentCheckboxes = studentTableBody.querySelectorAll('.student-checkbox');
    if (studentCheckboxes.length === 0) { 
        console.log("No student checkboxes found."); 
        bulkActionContainer.classList.add('hidden'); 
        selectAllCheckbox.disabled = true; 
        return; 
    }

    console.log("Initializing Bulk Student Actions... Found", studentCheckboxes.length, "checkboxes");

    // Check if we are on the /students page
    const onStudentsPage = (typeof window.filterStudentsGlobally === 'function');

    window.updateBulkActionsVisibility = () => {
        let visibleCheckboxes;
        if (onStudentsPage) {
            visibleCheckboxes = Array.from(studentCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none');
        } else {
            visibleCheckboxes = Array.from(studentCheckboxes);
        }

        const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
        console.log("Checked count:", checkedCount, "Visible count:", visibleCheckboxes.length);
        
        selectedCountText.textContent = `${checkedCount} student${checkedCount !== 1 ? 's' : ''} selected`;
        bulkActionContainer.classList.toggle('hidden', checkedCount === 0);
        deleteSelectedButton.disabled = (checkedCount === 0);
        selectAllCheckbox.checked = visibleCheckboxes.length > 0 && checkedCount === visibleCheckboxes.length;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < visibleCheckboxes.length;
    };

    selectAllCheckbox.addEventListener('change', () => {
        let visibleCheckboxes;
        if (onStudentsPage) {
             visibleCheckboxes = Array.from(studentCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none');
        } else {
             visibleCheckboxes = Array.from(studentCheckboxes);
        }
        
        console.log("Select all changed. Checked:", selectAllCheckbox.checked, "Visible checkboxes:", visibleCheckboxes.length);
        
        visibleCheckboxes.forEach(cb => {
            cb.checked = selectAllCheckbox.checked;
            console.log("Setting checkbox", cb.value, "to", cb.checked);
        });
        
        updateBulkActionsVisibility();
    });

    studentCheckboxes.forEach(cb => { 
        cb.addEventListener('change', () => {
            console.log("Checkbox changed:", cb.value, "checked:", cb.checked);
            updateBulkActionsVisibility();
        });
    });

    deleteSelectedButton.addEventListener('click', async () => {
        if (deleteSelectedButton.disabled) {
            console.warn("Delete already in progress. Ignoring extra click.");
            return; 
        }
        let selectedIds;
        if (onStudentsPage) {
            selectedIds = Array.from(studentCheckboxes)
                .filter(cb => cb.checked && cb.closest('tr').style.display !== 'none')
                .map(cb => cb.value);
        } else {
            selectedIds = Array.from(studentCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
        }

        console.log("Delete clicked. Selected IDs:", selectedIds);

        if (selectedIds.length === 0) { 
            showToast('No students selected.', 'info'); 
            return; 
        }

        if (!confirm(`Are you sure you want to delete ${selectedIds.length} student(s)? This action cannot be undone.`)) {
            return;
        }

        const originalButtonHTML = deleteSelectedButton.innerHTML; 
        setLoadingState(deleteSelectedButton, true, originalButtonHTML);

        try {
            console.log("Sending delete request for IDs:", selectedIds);
            
            const result = await fetchWithErrorHandling_Robust('/delete_students_bulk', { 
                method: 'POST', 
                body: JSON.stringify({ student_ids: selectedIds }) 
            });

            console.log("Delete response:", result);

            if (result.success !== false) {
                showToast(result.message || `${result.deleted_count || selectedIds.length} students deleted!`, 'success');
                
                // Remove rows from table
                selectedIds.forEach(id => { 
                    console.log("Removing row for student:", id);
                    const row = document.querySelector(`tr[data-student-id="${id}"]`);
                    if (row) {
                        row.remove();
                        console.log("Row removed successfully");
                    } else {
                        console.warn("Row not found for ID:", id);
                    }
                });
                
                // *** FIX: Uncheck all checkboxes after deletion ***
                studentCheckboxes.forEach(cb => {
                    if (cb.checked) {
                        cb.checked = false;
                    }
                });
                
                // Reset selection state
                selectAllCheckbox.checked = false; 
                updateBulkActionsVisibility();
                
                // Update summary stats if on class page
                if (window.location.pathname.startsWith('/class/')) {
                    updateClassSummaryStats();
                    const totalStudentsEl = document.getElementById('stat-total-students');
                    if (totalStudentsEl) {
                        const currentCount = parseInt(totalStudentsEl.textContent) || 0;
                        totalStudentsEl.textContent = Math.max(0, currentCount - selectedIds.length);
                    }
                }
            } else { 
                throw new Error(result.message || 'Failed to delete students.'); 
            }
        } catch (error) { 
            console.error('Bulk delete error:', error); 
            showToast(`Error: ${error.message}`, 'error');
        } finally { 
            setLoadingState(deleteSelectedButton, false, originalButtonHTML); 
        }
    });

    updateBulkActionsVisibility(); // Initial check on load
}
// --- END Bulk Student Actions ---


// --- **** UPDATED: Delete Student Function **** ---
async function deleteStudent(studentId) {
    if (confirm(`Delete student? This cannot be undone.`)) {
        try {
            const result = await fetchWithErrorHandling(`/delete_student/${studentId}`, { method: 'POST' });
            if (result.success) {
                showToast(result.message || 'Student deleted!', 'success');
                const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
                if (row) {
                     row.remove(); // Remove row from table
                     
                     // Update summary cards if on class page
                     if (window.location.pathname.startsWith('/class/')) {
                        updateClassSummaryStats();
                        // Also update the total student count in the header
                        const totalStudentsEl = document.getElementById('stat-total-students');
                        if (totalStudentsEl) {
                            const currentCount = parseInt(totalStudentsEl.textContent) || 0;
                            totalStudentsEl.textContent = Math.max(0, currentCount - 1);
                        }
                    }
                } else {
                     setTimeout(() => window.location.href = '/students', 1000); // Fallback reload
                }
                 const editModal = document.getElementById('editStudentModal');
                 if (editModal && !editModal.classList.contains('hidden') && editModal.querySelector(`form[data-student-id="${studentId}"]`)) {
                     closeEditStudentModal();
                 }
            } else { throw new Error(result.message || 'Failed to delete.'); }
        } catch (error) { console.error('Error deleting student:', error); showToast(`Error: ${error.message}`, 'error'); }
    }
}
// --- **** END UPDATED **** ---

function deleteAssignment(assignmentId) {
     closeDropdowns();
     if (confirm('Delete this assignment? This will delete it for all classes and remove all associated grades. This cannot be undone.')) {
         fetchWithErrorHandling('/delete_assignment', { method: 'POST', body: JSON.stringify({ assignment_id: assignmentId }) })
         .then(result => {
             if (result.success) {
                 showToast('Assignment deleted.', 'success');
                 const card = document.querySelector(`button[onclick*="toggleDropdown('${assignmentId}')"]`)?.closest('.assignment-card');
                 if (card) { card.remove(); const grid = document.querySelector('.assignments-grid, .assignments-stack'); if (grid && !grid.querySelector('.assignment-card')) { const empty = grid.querySelector('div:not(.assignment-card)'); if(empty) empty.style.display = ''; } }
                 else { location.reload(); }
             } else { throw new Error(result.message || 'Failed to delete.'); }
         })
         .catch(error => { console.error('Error deleting assignment:', error); showToast(`Error: ${error.message}`, 'error'); });
     }
}

// --- Reset Data ---
async function resetAllData() {
    const btn = document.getElementById('confirmReset'); const original = btn? btn.innerHTML : 'Reset';
    if(btn) setLoadingState(btn, true, original);
    try {
        const result = await fetchWithErrorHandling('/reset_data', { method: 'POST' });
        if (result.success) { showToast('Data reset!', 'success'); hideResetConfirmation(); setTimeout(() => window.location.href = '/', 1000); }
        else { throw new Error(result.message || 'Reset failed.'); }
    } catch (error) { console.error('Error resetting:', error); showToast(`Error: ${error.message}`, 'error'); }
    finally { if(btn) setLoadingState(btn, false, original); }
}

// --- Dropdown Functions ---
function toggleDropdown(targetId) { const d = document.getElementById(`dropdown-${targetId}`); if(d){ const h = d.classList.contains('hidden'); closeDropdowns(targetId); d.classList.toggle('hidden', !h); } }
function closeDropdowns(excludeId = null) { document.querySelectorAll('[id^="dropdown-"]').forEach(d => { if ((!excludeId || d.id !== `dropdown-${excludeId}`) && !d.classList.contains('hidden')) d.classList.add('hidden'); }); }
function initializeDropdownListeners() { document.addEventListener('click', (e) => { if (!e.target.closest('[onclick*="toggleDropdown"]') && !e.target.closest('[id^="dropdown-"]')) closeDropdowns(); }); }

// --- Helper Functions ---
async function refreshAssignmentClassCheckboxes(listElement) {
    if (!listElement) { console.error("Class list element missing for checkboxes."); return; }
    listElement.innerHTML = '<p class="text-sm text-gray-500">Loading classes...</p>';
    try {
        const response = await fetch('/api/get_classes?nocache=' + new Date().getTime());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const classes = await response.json();
        listElement.innerHTML = ''; // Clear loading
        if (classes && classes.length > 0) {
            classes.sort((a,b) => (a.name+a.section).localeCompare(b.name+b.section)).forEach(cls => {
                const label = document.createElement('label');
                label.className = "flex items-center p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer";
                label.setAttribute('for', `class-check-${cls.id}`);
                label.innerHTML = `
                    <input type="checkbox" id="class-check-${cls.id}" value="${cls.id}" class="assignment-class-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                    <span class="ml-3 text-sm text-gray-700">${cls.name} - ${cls.section} (${cls.campus || 'N/A'})</span>
                `; // Added campus display
                listElement.appendChild(label);
            });
        } else {
             listElement.innerHTML = '<p class="text-sm text-gray-500">No classes found. Please add a class first.</p>';
        }
    } catch(e) {
         console.error("Failed to refresh class checkboxes:", e);
         listElement.innerHTML = '<p class="text-sm text-red-500">Error loading classes.</p>';
    }
}
async function refreshAllClassSelects() {
    console.log("Refreshing all class selects...");
    const selectsToRefresh = [
        document.getElementById('addStudentClass'),
        document.getElementById('editStudentClass'),
        document.getElementById('classFilter'), // assignments page
        document.getElementById('class_id'), // gradebook page
        // Removed grade/section/campus filters as they don't list classes directly
    ];
    // Also refresh class checkboxes in Add Assignment modal
    await refreshAssignmentClassCheckboxes(document.getElementById('assignmentClassList'));

    for (const select of selectsToRefresh) {
        if (select) {
            console.log(`Refreshing: ${select.id}`);
            try {
                 // Pass true for the isGradebookClassSelect flag only if it's the gradebook class select
                 await refreshSelectWithOptions(select, '/api/get_classes', 'Error loading classes');
            } catch(e) {
                 console.error(`Failed to refresh ${select.id}: ${e}`);
            }
        } else {
             // Silently ignore if a select element isn't found (e.g., gradebook class select on a different page)
             // console.warn(`Select element not found for refreshing: ${select?.id || 'ID unknown'}`);
        }
    }
    // Refresh student page filters separately if needed (they use different data)
    // Example: await refreshSelectWithOptions(document.getElementById('gradeFilter'), '/api/get_grades', 'Error loading grades');
}


function selectAllClasses() {
    document.querySelectorAll('.assignment-class-checkbox').forEach(cb => cb.checked = true);
    const errorEl = document.getElementById('classSelectionError');
    if(errorEl) errorEl.classList.add('hidden');
}
function deselectAllClasses() {
    document.querySelectorAll('.assignment-class-checkbox').forEach(cb => cb.checked = false);
}

// Validation
async function validateUniqueFields(studentId, uid, rollNumber) {
    try {
        const response = await fetchWithErrorHandling('/check_student_duplicates', {
            method: 'POST',
            body: JSON.stringify({
                student_id: studentId,
                uid: uid,
                roll_number: rollNumber
            })
        });
        return response;
    } catch (error) {
        console.error("Validation check failed:", error);
        // Return a structure indicating failure but not duplicates, allowing save attempt
        return { success: false, has_duplicates: false, message: "Could not validate uniqueness." };
    }
}

// --- Global Exports ---
window.updateGrade = updateGrade;
window.updateAssignmentGrade = updateAssignmentGrade;
window.showToast = showToast;
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
window.deleteAssignment = deleteAssignment;
// Note: The assignments.html template needs to be updated to correctly call viewAssignmentGrades
// For assignments linked to multiple classes, it should generate multiple links or prompt the user.
// The function below assumes it's called with a *single*, valid classId for the given assignId.
window.viewAssignmentGrades = (assignId, classId) => {
    closeDropdowns();
    if (assignId && classId) {
        window.location.href = `/gradebook?assignment_id=${assignId}&class_id=${classId}`;
    } else if (assignId) {
         // This case might happen if the HTML doesn't provide a classId (e.g., assignment with no classes?)
         // Or if the assignment has multiple classes and the HTML needs updating.
         showToast('Please select a specific class to view grades for this assignment.', 'info');
         // Potentially redirect to the assignment list or a class selection page.
         // window.location.href = `/assignments`; // Example fallback
    } else {
        showToast('Cannot determine assignment or class.', 'error');
    }
};
window.showNotImplementedToast = showNotImplementedToast;
window.showImportStudentsModal = showImportStudentsModal;
window.closeImportStudentsModal = closeImportStudentsModal;
window.showManageClassesModal = showManageClassesModal;
window.closeManageClassesModal = closeManageClassesModal;
window.showAddClassModal = showAddClassModal;
window.showEditClassModal = showEditClassModal;
window.closeClassFormModal = closeClassFormModal;
window.addClass = addClass;
window.editClass = editClass;
window.deleteClass = deleteClass;
window.selectAllClasses = selectAllClasses;
window.deselectAllClasses = deselectAllClasses;

console.log("script.js loaded and all initializers called.");