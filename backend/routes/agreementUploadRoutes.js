import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router();

// Configure storage to point to the frontend's public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', '..', 'client', 'public');

// Ensure the directory exists
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, publicDir);
    },
    filename: function (req, file, cb) {
        // Prevent overwriting built-in templates
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension);
        cb(null, baseName + '_' + uniqueSuffix + extension);
    }
});

const upload = multer({ storage: storage });

// ── POST /template-pdf — Upload custom template PDF ──
router.post('/template-pdf', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ detail: 'No file uploaded' });
        }

        // Return the exact filename so the frontend can request it from its public URL
        const filename = file.filename;
        
        res.json({
            status: 'success',
            filename: filename,
            url: `/${filename}`,
            message: 'Template uploaded successfully'
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ detail: err.message });
    }
});

export default router;
