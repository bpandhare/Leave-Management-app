/**
 * Role-based access control utilities
 */

/**
 * Check if user has required role
 * @param {Object} user - User object from session
 * @param {string|Array} requiredRole - Required role or array of roles
 * @returns {boolean} True if user has required role
 */
function hasRole(user, requiredRole) {
    if (!user || !user.role) return false;
    
    if (Array.isArray(requiredRole)) {
        return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
}

/**
 * Check if user can view leave application
 * @param {Object} user - User object from session
 * @param {Object} leave - Leave application object
 * @returns {boolean} True if user can view the leave
 */
function canViewLeave(user, leave) {
    if (!user || !leave) return false;
    
    // HOD can view all leaves in their department
    if (user.role === 'HOD') {
        return leave.faculty.department === user.department;
    }
    
    // Faculty can only view their own leaves
    if (user.role === 'Faculty') {
        return leave.faculty._id.toString() === user.id;
    }
    
    return false;
}

/**
 * Check if user can approve/reject leave
 * @param {Object} user - User object from session
 * @param {Object} leave - Leave application object
 * @returns {boolean} True if user can approve the leave
 */
function canApproveLeave(user, leave) {
    if (!user || !leave) return false;
    
    // Only HOD can approve leaves
    if (user.role !== 'HOD') return false;
    
    // HOD can only approve leaves from their department
    return leave.faculty.department === user.department;
}

/**
 * Check if user can assign workload
 * @param {Object} user - User object from session
 * @param {Object} targetFaculty - Faculty to assign workload to
 * @returns {boolean} True if user can assign workload
 */
function canAssignWorkload(user, targetFaculty) {
    if (!user || !targetFaculty) return false;
    
    // Both Faculty and HOD can assign workload
    if (user.role === 'Faculty' || user.role === 'HOD') {
        // Can only assign to faculty in the same department
        return targetFaculty.department === user.department;
    }
    
    return false;
}

/**
 * Get accessible features based on user role
 * @param {Object} user - User object from session
 * @returns {Object} Features accessibility object
 */
function getAccessibleFeatures(user) {
    const baseFeatures = {
        viewDashboard: true,
        viewProfile: true,
        changePassword: true
    };
    
    if (!user) return baseFeatures;
    
    const roleFeatures = {
        Faculty: {
            ...baseFeatures,
            applyLeave: true,
            viewOwnLeaves: true,
            assignWorkload: true,
            manageWorkloadAssignments: true
        },
        HOD: {
            ...baseFeatures,
            viewAllLeaves: true,
            approveLeaves: true,
            viewDepartmentStats: true,
            manageFaculty: true,
            generateReports: true,
            assignWorkload: true
        }
    };
    
    return roleFeatures[user.role] || baseFeatures;
}

/**
 * Check if user can perform action on resource
 * @param {Object} user - User object from session
 * @param {string} action - Action to perform (view, edit, delete, approve)
 * @param {string} resource - Resource type (leave, workload, user)
 * @param {Object} resourceObj - The resource object
 * @returns {boolean} True if action is allowed
 */
function canPerformAction(user, action, resource, resourceObj = null) {
    if (!user) return false;
    
    const permissions = {
        Faculty: {
            leave: {
                view: (leave) => leave.faculty._id.toString() === user.id,
                edit: (leave) => leave.faculty._id.toString() === user.id && leave.status === 'Pending',
                delete: (leave) => leave.faculty._id.toString() === user.id && leave.status === 'Pending'
            },
            workload: {
                view: true,
                accept: (workload) => workload.faculty._id.toString() === user.id,
                reject: (workload) => workload.faculty._id.toString() === user.id
            }
        },
        HOD: {
            leave: {
                view: (leave) => leave.faculty.department === user.department,
                edit: false,
                delete: false,
                approve: (leave) => leave.faculty.department === user.department && leave.status === 'Pending'
            },
            workload: {
                view: true,
                assign: true,
                manage: true
            },
            user: {
                view: (targetUser) => targetUser.department === user.department,
                edit: false,
                delete: false
            }
        }
    };
    
    const rolePermissions = permissions[user.role];
    if (!rolePermissions || !rolePermissions[resource]) return false;
    
    const actionPermission = rolePermissions[resource][action];
    
    if (typeof actionPermission === 'function') {
        return actionPermission(resourceObj);
    }
    
    return actionPermission === true;
}

module.exports = {
    hasRole,
    canViewLeave,
    canApproveLeave,
    canAssignWorkload,
    getAccessibleFeatures,
    canPerformAction
};