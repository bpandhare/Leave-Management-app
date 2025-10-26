const crypto = require('crypto');

/**
 * Generate a random token for various purposes
 * @param {number} length - Length of the token
 * @returns {string} Random token
 */
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a numeric OTP
 * @param {number} length - Length of the OTP
 * @returns {string} Numeric OTP
 */
function generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

/**
 * Generate a unique leave reference number
 * @returns {string} Leave reference number
 */
function generateLeaveReference() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `LEAVE-${timestamp}-${random}`;
}

/**
 * Generate a workload assignment ID
 * @returns {string} Workload assignment ID
 */
function generateWorkloadId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `WORK-${timestamp}-${random}`;
}

module.exports = {
    generateToken,
    generateOTP,
    generateLeaveReference,
    generateWorkloadId
};