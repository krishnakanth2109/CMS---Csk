import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getAgreementDB as getDB } from '../config/agreementDatabase.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Helpers ──
function fixId(doc) {
    if (doc && doc._id) {
        doc.id = doc._id.toString();
        delete doc._id;
    }
    return doc;
}

function sanitizeDoc(doc) {
    if (!doc) return doc;

    let email = doc.email;
    if (email !== null && email !== undefined && typeof email !== 'string') {
        doc.email = `${parseInt(email)}@imported.local`;
    } else if (!email) {
        doc.email = 'unknown@imported.local';
    }

    const fields = ['designation', 'department', 'name', 'emp_id', 'location',
        'employment_type', 'address', 'replacement', 'signature',
        'invoice_post_joining', 'payment_release'];

    for (const field of fields) {
        const val = doc[field];
        if (val !== null && val !== undefined) {
            if (typeof val === 'number' && isNaN(val)) {
                doc[field] = null;
            } else if (typeof val !== 'string' && val !== null) {
                doc[field] = String(val);
            }
        }
    }

    const comp = doc.compensation;
    if (comp && typeof comp === 'object' && !('percentage' in comp)) {
        doc.compensation = { percentage: 0.0 };
    } else if (!comp) {
        doc.compensation = { percentage: 0.0 };
    }

    return doc;
}

// ── POST / — Create Company ──
router.post('/', async (req, res) => {
    try {
        const db = getDB();
        const body = req.body;

        const existing = await db.collection('companies').findOne({ email: body.email });
        if (existing) {
            return res.status(400).json({ detail: 'Email already registered' });
        }

        const percentage = body.percentage || 0;
        const compData = { ...body };
        delete compData.percentage;

        // Convert joining_date string to Date
        if (compData.joining_date && typeof compData.joining_date === 'string') {
            compData.joining_date = new Date(compData.joining_date);
        }

        // Auto-generate emp_id if not provided
        if (!compData.emp_id) {
            const count = await db.collection('companies').countDocuments();
            compData.emp_id = `EMP${String(count + 1).padStart(3, '0')}`;
        }

        const newDoc = {
            ...compData,
            status: 'Pending',
            created_at: new Date(),
            compensation: { percentage: parseFloat(percentage) }
        };

        const result = await db.collection('companies').insertOne(newDoc);
        newDoc._id = result.insertedId;

        res.status(201).json(fixId(newDoc));
    } catch (err) {
        console.error('Create company error:', err);
        res.status(500).json({ detail: err.message });
    }
});

// ── GET / — List Companies ──
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const skip = parseInt(req.query.skip) || 0;
        const limit = parseInt(req.query.limit) || 100;

        const cursor = db.collection('companies').find().skip(skip).limit(limit);
        const companies = [];
        for await (const doc of cursor) {
            companies.push(sanitizeDoc(fixId(doc)));
        }
        res.json(companies);
    } catch (err) {
        console.error('List companies error:', err);
        res.status(500).json({ detail: err.message });
    }
});

// ── GET /template — Download Excel Template ──
router.get('/template', (req, res) => {
    const headers = [
        'Company Name', 'Email Contact', 'Date of Agreement',
        'Compensation %', 'Registered Office Address',
        'Replacement Period (Days)', 'Invoice Post Joining (Days)',
        'Payment Release (Days)', 'Signatory Name', 'Designation'
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Company_Import_Template.xlsx');
    res.send(buffer);
});

// ── GET /:id — Get Single Company ──
router.get('/:id', async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ detail: 'Invalid ObjectId' });
        }

        const company = await db.collection('companies').findOne({ _id: new ObjectId(id) });
        if (!company) {
            return res.status(404).json({ detail: 'Company not found' });
        }

        res.json(fixId(company));
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
});

// ── DELETE /:id — Delete Company ──
router.delete('/:id', async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ detail: 'Invalid ObjectId' });
        }

        const result = await db.collection('companies').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ detail: 'Company not found' });
        }

        // Also delete generated agreements for this company
        await db.collection('generated_agreements').deleteMany({ employee_id: new ObjectId(id) });

        res.status(204).send();
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
});

// ── PUT /:id — Update Company ──
router.put('/:id', async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ detail: `Invalid ObjectId: '${id}'` });
        }

        const existing = await db.collection('companies').findOne({ _id: new ObjectId(id) });
        if (!existing) {
            return res.status(404).json({ detail: 'Company not found' });
        }

        const updateData = { ...req.body };
        const newPercentage = updateData.percentage;
        delete updateData.percentage;

        // Convert joining_date string to Date
        if (updateData.joining_date && typeof updateData.joining_date === 'string') {
            updateData.joining_date = new Date(updateData.joining_date);
        }

        if (newPercentage !== null && newPercentage !== undefined) {
            updateData.compensation = { percentage: parseFloat(newPercentage) };
        }

        await db.collection('companies').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        const updatedDoc = await db.collection('companies').findOne({ _id: new ObjectId(id) });
        res.json(fixId(updatedDoc));
    } catch (err) {
        res.status(500).json({ detail: err.message });
    }
});

// ── POST /upload — Bulk Import Companies ──
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const db = getDB();
        const file = req.file;

        if (!file) {
            return res.status(400).json({ detail: 'No file uploaded' });
        }

        const wb = XLSX.read(file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: null });

        // Normalize column names
        const data = rawData.map(row => {
            const normalized = {};
            for (const [key, val] of Object.entries(row)) {
                normalized[key.toLowerCase().trim().replace(/\s+/g, '_')] = val;
            }
            return normalized;
        });

        const findCol = (row, aliases) => {
            for (const alias of aliases) {
                if (alias in row) return row[alias];
            }
            return null;
        };

        let successCount = 0;
        const errors = [];

        for (let i = 0; i < data.length; i++) {
            try {
                const row = data[i];

                const email = findCol(row, ['email', 'email_id', 'email_address', 'email_contact']);
                if (!email) {
                    errors.push(`Row ${i + 2}: Email missing`);
                    continue;
                }

                const existing = await db.collection('companies').findOne({ email: email });
                if (existing) {
                    errors.push(`Skipped ${email}: Exists`);
                    continue;
                }

                const name = findCol(row, ['name', 'full_name', 'company_name']) || 'Unknown';
                const desg = findCol(row, ['designation', 'role']) || 'TBD';

                let jd = findCol(row, ['joining_date', 'agreement_date', 'doj', 'date_of_agreement']);
                let joiningDate;
                try {
                    joiningDate = jd ? new Date(jd).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                } catch {
                    joiningDate = new Date().toISOString().split('T')[0];
                }

                let empId = findCol(row, ['emp_id', 'partner_id']);
                if (!empId) {
                    const count = await db.collection('companies').countDocuments();
                    empId = `EMP${String(count + 1 + successCount).padStart(3, '0')}`;
                }

                const pctVal = findCol(row, ['percentage', 'revenue_share_percentage_(%)', 'compensation_%']) || 0;
                const pct = parseFloat(pctVal) || 0;

                const replacement = row['replacement_period_(days)'] || row['replacement_(days)'] || row['replacement'] || '';
                const invoicePostJoining = row['invoice_post_joining_(days)'] || row['invoice_post_joining'] || '';
                const paymentRelease = row['payment_release_(days)'] || row['payment_release'] || '';
                const signatoryName = row['signatory_name'] || '';

                const doc = {
                    emp_id: String(empId),
                    name,
                    email,
                    designation: desg,
                    joining_date: joiningDate,
                    location: row.location || 'Remote',
                    address: row.registered_office_address || row.address || '',
                    replacement: String(replacement),
                    invoice_post_joining: String(invoicePostJoining),
                    payment_release: String(paymentRelease),
                    signature: signatoryName,
                    status: 'Pending',
                    created_at: new Date(),
                    compensation: { percentage: pct }
                };

                await db.collection('companies').insertOne(doc);
                successCount++;
            } catch (e) {
                errors.push(`Row ${i + 2}: ${e.message}`);
            }
        }

        res.json({ status: 'success', imported_count: successCount, errors });
    } catch (err) {
        console.error('Bulk import error:', err);
        res.status(500).json({ detail: err.message });
    }
});

export default router;
