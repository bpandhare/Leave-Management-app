const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'bhosalepayal2003@gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
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

const sendLeaveNotification = async (to, subject, message) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
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