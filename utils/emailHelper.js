// /utils/emailHelper.js
import nodemailer from 'nodemailer';

// Create transporter only if email credentials are available
let transporter = null;

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('Email credentials not configured, email functionality disabled');
    return null;
  }

  try {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } catch (error) {
    console.error('Failed to create email transporter:', error.message);
    return null;
  }
};

export const sendEmail = async (to, subject, text) => {
  try {
    // Create transporter if not already created
    if (!transporter) {
      transporter = createTransporter();
    }

    // If no transporter available, skip email sending
    if (!transporter) {
      console.log('Email transporter not available, skipping email send');
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error.message);
  }
};
