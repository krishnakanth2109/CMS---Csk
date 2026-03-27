import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getAgreementDB as getDB } from '../config/agreementDatabase.js';
import { generateAgreement } from '../services/agreementService.js';

const router = Router();

// ── POST /generate — Generate Agreement Letter ──
router.post('/generate', async (req, res) => {
    try {
        const db = getDB();
        const { employee_id, letter_type = 'Agreement', tone = 'Professional', company_name = 'Arah Infotech Pvt Ltd' } = req.body;

        if (!ObjectId.isValid(employee_id)) {
            return res.status(400).json({ detail: 'Invalid ObjectId' });
        }

        const company = await db.collection('companies').findOne({ _id: new ObjectId(employee_id) });
        if (!company) {
            return res.status(404).json({ detail: 'Company not found' });
        }

        const comp = company.compensation || {};
        const today = new Date().toISOString().split('T')[0];

        const dataContext = {
            name: company.name,
            company_name: company_name,
            percentage: comp.percentage || 0,
            address: company.address || '',
            joining_date: company.joining_date || today,
            replacement: company.replacement || 60,
            invoice_post_joining: company.invoice_post_joining || 45,
            payment_release: company.payment_release || 15,
            signature: company.signature || 'Authorized Signatory',
            current_date: today
        };

        const generatedText = generateAgreement(dataContext, letter_type);

        // Save to DB
        const newLetter = {
            employee_id: new ObjectId(employee_id),
            emp_id: company.emp_id,
            letter_type,
            content: generatedText,
            file_path: null,
            generated_on: new Date()
        };
        await db.collection('generated_agreements').insertOne(newLetter);

        res.json({ content: generatedText, file_path: null });
    } catch (err) {
        console.error('Generate agreement error:', err);
        res.status(500).json({ detail: err.message });
    }
});

// ── POST /download-docx — Download Agreement as DOCX ──
router.post('/download-docx', async (req, res) => {
    try {
        // Note: For DOCX conversion, we return a simple error since htmldocx is Python-only
        // The frontend handles PDF generation directly
        res.status(501).json({ detail: 'DOCX download is handled client-side. Use PDF download instead.' });
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
});

export default router;
