document.addEventListener('DOMContentLoaded', async function () {
    const pendingContainer = document.getElementById('pendingAssignments');
    if (!pendingContainer) return;

    await loadAssignments();
});

async function loadAssignments() {
    const pendingContainer = document.getElementById('pendingAssignments');
    if (!pendingContainer) return;

    pendingContainer.innerHTML = `
        <div class="text-center py-8">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto"></div>
            <p class="text-gray-500 mt-4">Loading assignments...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/faculty/workload-assignments', {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load assignments: ${response.status}`);
        }

        const payload = await response.json();
        if (!payload.success || !Array.isArray(payload.data)) {
            throw new Error('Invalid assignment response');
        }

        const assignments = payload.data;
        renderAssignments(assignments);
    } catch (error) {
        console.error(error);
        pendingContainer.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
                <p>Unable to load workload assignments right now.</p>
            </div>
        `;
    }
}

function renderAssignments(assignments) {
    const container = document.getElementById('pendingAssignments');

    if (!assignments || assignments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-check-circle text-3xl mb-3"></i>
                <p>No workload assignments at the moment.</p>
            </div>
        `;
        return;
    }

    const rows = assignments.map(assignment => {
        const status = assignment.status ? assignment.status.toUpperCase() : 'PENDING';
        const isPending = assignment.status === 'pending';

        return `
            <div class="border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">${assignment.leaveApplication?.leaveType || 'Workload Assignment'}</h3>
                        <p class="text-sm text-gray-500">Assigned by: ${assignment.assignedBy?.name || assignment.assignedBy?.email || 'Unknown'}</p>
                        <p class="text-sm text-gray-500">Leave Dates: ${assignment.leaveApplication?.startDate ? new Date(assignment.leaveApplication.startDate).toLocaleDateString() : 'N/A'} - ${assignment.leaveApplication?.endDate ? new Date(assignment.leaveApplication.endDate).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div class="text-right">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${status === 'APPROVED' ? 'bg-green-100 text-green-700' : status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">
                            ${status}
                        </span>
                    </div>
                </div>
                <div class="grid gap-4 md:grid-cols-2 mb-4">
                    <div>
                        <p class="text-sm text-gray-600"><strong>Subjects:</strong> ${assignment.subjects?.length ? assignment.subjects.join(', ') : 'Not specified'}</p>
                        <p class="text-sm text-gray-600"><strong>Classes:</strong> ${assignment.classes?.length ? assignment.classes.join(', ') : 'Not specified'}</p>
                        <p class="text-sm text-gray-600"><strong>Work Date:</strong> ${assignment.date ? new Date(assignment.date).toLocaleDateString() : 'Not specified'}</p>
                        <p class="text-sm text-gray-600"><strong>Time Slot:</strong> ${assignment.timeSlot || 'Not specified'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600"><strong>Total Hours:</strong> ${assignment.totalHours || 'N/A'}</p>
                        <p class="text-sm text-gray-600"><strong>Leave Reason:</strong> ${assignment.leaveApplication?.reason || 'Not provided'}</p>
                        ${assignment.notes ? `<p class="text-sm text-gray-600"><strong>Notes:</strong> ${assignment.notes}</p>` : ''}
                    </div>
                </div>
                ${isPending ? `
                    <div class="flex flex-col sm:flex-row gap-3">
                        <button onclick="handleAssignmentAction('${assignment._id}', 'approve')" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Accept</button>
                        <button onclick="handleAssignmentAction('${assignment._id}', 'reject')" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = rows;
}

async function handleAssignmentAction(assignmentId, action) {
    let url = `/api/faculty/workload-assignments/${assignmentId}/approve`;
    let method = 'POST';
    let body = null;

    if (action === 'reject') {
        const reason = prompt('Please enter a reason for rejecting this workload assignment:');
        if (!reason) {
            return;
        }
        url = `/api/faculty/workload-assignments/${assignmentId}/reject`;
        body = JSON.stringify({ reason });
    }

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body
        });

        const data = await response.json();
        if (!data.success) {
            alert(`Error: ${data.message || 'Unable to perform action'}`);
            return;
        }

        alert(data.message);
        await loadAssignments();
    } catch (error) {
        console.error('Error handling assignment action:', error);
        alert('Unable to update assignment status. Please try again.');
    }
}
