let nodemailer;
let transporter;

try {
    nodemailer = require('nodemailer');
    
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    // Verify connection configuration
    transporter.verify(function (error, success) {
        if (error) {
            console.log('❌ Email configuration error:', error);
        } else {
            console.log('✅ Email server is ready to send messages');
        }
    });
} catch (error) {
    console.error('❌ Nodemailer initialization error:', error.message);
    console.log('⚠️  Email notifications will be disabled');
    transporter = null;
}

const sendLeaveNotification = async (to, subject, message) => {
    if (!transporter) {
        console.warn('⚠️  Email transporter not initialized, skipping email notification');
        return false;
    }
    
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || `Leave Management System <${process.env.SMTP_USER}>`,
            to: to,
            subject: subject,
            html: message,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to: ${to}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
};

module.exports = {
    transporter,
    sendLeaveNotification,
};