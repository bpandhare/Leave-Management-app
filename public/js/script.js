// Leave Management System - Client-side JavaScript

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Auto-dismiss alerts after 5 seconds
    autoDismissAlerts();
    
    // Initialize date calculations for leave forms
    initializeDateCalculations();
    
    // Initialize form validations
    initializeFormValidations();
    
    // Initialize interactive elements
    initializeInteractiveElements();
}

// Auto-dismiss alerts
function autoDismissAlerts() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            if (alert && alert.parentNode) {
                alert.style.transition = 'opacity 0.5s ease';
                alert.style.opacity = '0';
                setTimeout(() => {
                    if (alert && alert.parentNode) {
                        alert.remove();
                    }
                }, 500);
            }
        }, 5000);
    });
}

// Date calculations for leave forms
function initializeDateCalculations() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const totalDaysInput = document.getElementById('totalDays');

    if (startDateInput && endDateInput && totalDaysInput) {
        // Set minimum date to today
        const today = new Date().toISOString().split('T')[0];
        startDateInput.min = today;
        endDateInput.min = today;

        // Calculate days when dates change
        [startDateInput, endDateInput].forEach(input => {
            input.addEventListener('change', calculateTotalDays);
        });

        function calculateTotalDays() {
            if (startDateInput.value && endDateInput.value) {
                const start = new Date(startDateInput.value);
                const end = new Date(endDateInput.value);
                
                if (end >= start) {
                    const timeDiff = end.getTime() - start.getTime();
                    const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
                    totalDaysInput.value = days;
                } else {
                    totalDaysInput.value = '';
                    alert('End date must be after start date');
                    endDateInput.value = '';
                }
            }
        }
    }
}

// Form validations
function initializeFormValidations() {
    const forms = document.querySelectorAll('form[needs-validation]');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
                showFormErrors(this);
            }
        });
    });
}

function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            markFieldInvalid(input, 'This field is required');
        } else {
            markFieldValid(input);
        }
        
        // Email validation
        if (input.type === 'email' && input.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value)) {
                isValid = false;
                markFieldInvalid(input, 'Please enter a valid email address');
            }
        }
        
        // Password confirmation
        if (input.name === 'confirmPassword' && form.querySelector('#password')) {
            const password = form.querySelector('#password').value;
            if (input.value !== password) {
                isValid = false;
                markFieldInvalid(input, 'Passwords do not match');
            }
        }
    });
    
    return isValid;
}

function markFieldInvalid(field, message) {
    field.classList.add('border-red-500');
    field.classList.remove('border-gray-300');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error text-red-500 text-xs mt-1';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function markFieldValid(field) {
    field.classList.remove('border-red-500');
    field.classList.add('border-gray-300');
    
    // Remove error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

function showFormErrors(form) {
    const firstInvalid = form.querySelector('.border-red-500');
    if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
    }
}

// Interactive elements
function initializeInteractiveElements() {
    // Refresh button
    const refreshBtn = document.querySelector('button:contains("Refresh")');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Refreshing...';
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        });
    }
    
    // Workload assignment dynamic form
    initializeWorkloadForm();
    
    // Print functionality
    initializePrintButtons();
}

// Dynamic workload assignment form
function initializeWorkloadForm() {
    const addWorkloadBtn = document.getElementById('addWorkload');
    const workloadContainer = document.getElementById('workloadContainer');
    
    if (addWorkloadBtn && workloadContainer) {
        let workloadCount = workloadContainer.children.length;
        
        addWorkloadBtn.addEventListener('click', function() {
            workloadCount++;
            
            const workloadHTML = `
                <div class="workload-item border border-gray-200 rounded-lg p-4 mb-4">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="font-semibold text-gray-700">Workload Assignment ${workloadCount}</h4>
                        <button type="button" class="remove-workload text-red-500 hover:text-red-700">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-gray-700 text-sm font-bold mb-2">Assign to Faculty</label>
                            <select name="workload[${workloadCount}][faculty]" class="form-select" required>
                                <option value="">Select Faculty</option>
                                ${getFacultyOptions()}
                            </select>
                        </div>
                        <div>
                            <label class="block text-gray-700 text-sm font-bold mb-2">Subject</label>
                            <input type="text" name="workload[${workloadCount}][subject]" class="form-input" placeholder="Subject name" required>
                        </div>
                        <div>
                            <label class="block text-gray-700 text-sm font-bold mb-2">Date</label>
                            <input type="date" name="workload[${workloadCount}][date]" class="form-input" required>
                        </div>
                        <div>
                            <label class="block text-gray-700 text-sm font-bold mb-2">Time Slot</label>
                            <select name="workload[${workloadCount}][timeSlot]" class="form-select" required>
                                <option value="">Select Time Slot</option>
                                <option value="9:00-10:00">9:00 AM - 10:00 AM</option>
                                <option value="10:00-11:00">10:00 AM - 11:00 AM</option>
                                <option value="11:00-12:00">11:00 AM - 12:00 PM</option>
                                <option value="12:00-13:00">12:00 PM - 1:00 PM</option>
                                <option value="14:00-15:00">2:00 PM - 3:00 PM</option>
                                <option value="15:00-16:00">3:00 PM - 4:00 PM</option>
                                <option value="16:00-17:00">4:00 PM - 5:00 PM</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
            
            workloadContainer.insertAdjacentHTML('beforeend', workloadHTML);
            
            // Add event listener to remove button
            const removeBtn = workloadContainer.lastElementChild.querySelector('.remove-workload');
            removeBtn.addEventListener('click', function() {
                this.closest('.workload-item').remove();
                workloadCount--;
            });
        });
    }
}

function getFacultyOptions() {
    // This would typically be populated from server-side data
    // For now, return empty string - options are populated in EJS template
    return '';
}

// Print functionality
function initializePrintButtons() {
    const printBtns = document.querySelectorAll('.print-btn');
    printBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            window.print();
        });
    });
}

// Utility functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function formatDateTime(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// API calls (for future enhancements)
const API = {
    async getLeaveStats() {
        try {
            const response = await fetch('/api/stats');
            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            return null;
        }
    },
    
    async updateWorkloadStatus(leaveId, workloadIndex, status) {
        try {
            const response = await fetch(`/api/workload/${leaveId}/${workloadIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status })
            });
            return await response.json();
        } catch (error) {
            console.error('Error updating workload:', error);
            return { success: false, error: 'Network error' };
        }
    }
};

// Export for global access
window.LMS = {
    API,
    formatDate,
    formatDateTime,
    validateForm
};
// Fix for reject button blinking
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.reject-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Your existing reject logic here
            openRejectModal(this);
        });
    });
});