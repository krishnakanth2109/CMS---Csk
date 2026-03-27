import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getAgreementDB as getDB } from '../config/agreementDatabase.js';
import { sendAgreementEmail } from '../services/emailService.js';

const router = Router();

// ── POST /send — Send Agreement Email ──
router.post('/send', async (req, res) => {
    try {
        const db = getDB();
        const { employee_id, letter_content, pdf_base64, custom_message, subject, company_name = 'Arah Infotech Pvt Ltd' } = req.body;

        if (!ObjectId.isValid(employee_id)) {
            return res.status(400).json({ detail: 'Invalid ObjectId' });
        }

        const company = await db.collection('companies').findOne({ _id: new ObjectId(employee_id) });
        if (!company) {
            return res.status(404).json({ detail: 'Company not found' });
        }

        // Decode PDF if present
        let pdfBytes = null;
        if (pdf_base64) {
            let base64Data = pdf_base64;
            if (base64Data.includes('base64,')) {
                base64Data = base64Data.split('base64,')[1];
            }
            pdfBytes = Buffer.from(base64Data, 'base64');
        }

        const result = await sendAgreementEmail({
            recipientEmail: company.email,
            candidateName: company.name,
            letterContent: letter_content,
            pdfContent: pdfBytes,
            emailBody: custom_message,
            subject: subject,
            companyName: company_name
        });

        // Update status on success
        if (result.status === 'success') {
            await db.collection('companies').updateOne(
                { _id: new ObjectId(employee_id) },
                { $set: { status: 'Agreement Sent' } }
            );
        }

        res.json(result);
    } catch (err) {
        console.error('Send email error:', err);
        res.status(500).json({ detail: err.message });
    }
});

export default router;
