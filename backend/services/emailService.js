import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const SMTP_SERVER = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SENDER_EMAIL = (process.env.MAIL_USERNAME || '').trim();
const SENDER_PASSWORD = (process.env.MAIL_PASSWORD || '').trim();
const BREVO_API_KEY = (process.env.BREVO_API_KEY || '').trim();
const BREVO_SENDER_EMAIL = (process.env.BREVO_SENDER_EMAIL || SENDER_EMAIL).trim();

console.log('📧 Email Service Init');
console.log(`   Brevo Key loaded: ${BREVO_API_KEY ? 'YES' : 'NO'}`);
console.log(`   SMTP configured: ${SENDER_EMAIL ? 'YES' : 'NO'}`);

async function sendViaBrevo({ recipientEmail, candidateName, subject, body, pdfContent, companyName }) {
    const url = 'https://api.brevo.com/v3/smtp/email';
    const senderEmail = BREVO_SENDER_EMAIL || SENDER_EMAIL;

    const payload = {
        sender: { name: `${companyName} HR`, email: senderEmail },
        to: [{ email: recipientEmail, name: candidateName }],
        subject: subject,
        htmlContent: body.replace(/\n/g, '<br>')
    };

    if (pdfContent) {
        try {
            const b64Content = Buffer.isBuffer(pdfContent)
                ? pdfContent.toString('base64')
                : pdfContent;

            payload.attachment = [{
                content: b64Content,
                name: `Agreement_${candidateName.replace(/\s+/g, '_')}.pdf`
            }];
        } catch (e) {
            console.error('Error encoding PDF for Brevo:', e);
        }
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return { status: 'success', message: 'Email sent successfully via Brevo' };
        } else {
            const errorText = await response.text();
            console.error('Brevo API Error:', errorText);
            return { status: 'error', message: `Brevo API Error: ${errorText}` };
        }
    } catch (e) {
        console.error('Brevo Exception:', e);
        return { status: 'error', message: e.message };
    }
}

export async function sendAgreementEmail({ recipientEmail, candidateName, letterContent, pdfContent, emailBody, subject, companyName = 'Arah Infotech Pvt Ltd' }) {
    const finalBody = emailBody || `Dear ${candidateName},\n\nPlease find the agreement document attached.\n\nRegards,\nHR Team`;
    const finalSubject = subject || `Agreement - ${candidateName}`;

    // Try Brevo first
    if (BREVO_API_KEY) {
        return sendViaBrevo({
            recipientEmail,
            candidateName,
            subject: finalSubject,
            body: finalBody,
            pdfContent,
            companyName
        });
    }

    // Fall back to SMTP / Nodemailer
    if (!SENDER_EMAIL || !SENDER_PASSWORD) {
        return { status: 'error', message: 'Email service is not configured. Please add MAIL_USERNAME and MAIL_PASSWORD to your backend .env file.' };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_SERVER,
            port: SMTP_PORT,
            secure: false,
            auth: {
                user: SENDER_EMAIL,
                pass: SENDER_PASSWORD
            }
        });

        const mailOptions = {
            from: SENDER_EMAIL,
            to: recipientEmail,
            subject: finalSubject,
            text: finalBody
        };

        if (pdfContent) {
            mailOptions.attachments = [{
                filename: `Agreement_${candidateName.replace(/\s+/g, '_')}.pdf`,
                content: Buffer.isBuffer(pdfContent) ? pdfContent : Buffer.from(pdfContent, 'base64')
            }];
        } else if (letterContent) {
            mailOptions.text += `\n\n--- AGREEMENT TEXT ---\n${letterContent}`;
        }

        await transporter.sendMail(mailOptions);
        return { status: 'success', message: 'Email sent successfully' };
    } catch (e) {
        console.error('Error sending email:', e);
        return { status: 'error', message: e.message };
    }
}
