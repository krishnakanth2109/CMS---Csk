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
// STRATEGY: Multi-section body image approach.
// Each Word section starts with the letterhead image as a BODY image (not header).
// Body images are ALWAYS sharp in normal view. We force a page break between
// sections so the logo repeats on every page, sharp every time.
router.post('/download-docx', async (req, res) => {
    try {
        const { html_content } = req.body;

        const htmlToDocx = (await import('html-to-docx')).default;
        const AdmZip = (await import('adm-zip')).default;

        // ══════════════════════════════════════════════════
        // STEP 1: Sanitize HTML for Word XML compatibility
        // ══════════════════════════════════════════════════
        let safeHtml = html_content
            .replace(/&ldquo;/g, '\u201C')
            .replace(/&rdquo;/g, '\u201D')
            .replace(/&lsquo;/g, '\u2018')
            .replace(/&rsquo;/g, '\u2019')
            .replace(/&mdash;/g, '\u2014')
            .replace(/&ndash;/g, '\u2013')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/<ul[^>]*>/g, '')
            .replace(/<\/ul>/g, '')
            .replace(/<li>/g, '<p style="margin-left: 20px; margin-bottom: 5px;">\u2022 ')
            .replace(/<\/li>/g, '</p>')
            .replace(/<table[^>]*class="signature-table"[^>]*>/g, '<table cellpadding="5" cellspacing="0">')
            .replace(/<td[^>]*style="[^"]*"[^>]*>/g, '<td valign="top">');

        // BUG FIX: was using \\s+ (literal backslash-s) instead of \s+ for word count
        const wordCount = safeHtml.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;

        // ══════════════════════════════════════════════════
        // STEP 2: Generate text-only DOCX to extract paragraphs
        // ══════════════════════════════════════════════════
        // Use a large top margin so when we later combine with the logo,
        // there's breathing room between the logo and the text content.
        const htmlDocxBuffer = await htmlToDocx(safeHtml, null, {
            margins: { top: 2800, right: 1000, bottom: 2080, left: 1000 }
        });
        const textZip = new AdmZip(htmlDocxBuffer);
        let textDocXml = textZip.readAsText('word/document.xml');

        // ── Convert signature table → tab-aligned paragraphs ──
        const tblMatch = textDocXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
        if (tblMatch) {
            const rows = tblMatch[0].match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
            let replacementXml = '';
            const tabPpr = '<w:pPr><w:tabs><w:tab w:val="left" w:pos="5000"/></w:tabs></w:pPr>';

            for (const row of rows) {
                const cells = row.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
                if (cells.length < 2) continue;
                const leftRuns = cells[0].match(/<w:r>[\s\S]*?<\/w:r>/g) || [];
                const rightRuns = cells[1].match(/<w:r>[\s\S]*?<\/w:r>/g) || [];
                const hasContent = leftRuns.length > 0 || rightRuns.length > 0;

                if (!hasContent) {
                    const blank = '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>';
                    replacementXml += blank.repeat(4);
                } else {
                    replacementXml += `<w:p>${tabPpr}`;
                    replacementXml += leftRuns.join('');
                    replacementXml += '<w:r><w:tab/></w:r>';
                    replacementXml += rightRuns.join('');
                    replacementXml += '</w:p>';
                }
            }
            textDocXml = textDocXml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/, replacementXml);
        }

        // ── Extract all body paragraphs (strip sectPr) ──
        const bodyMatch = textDocXml.match(/<w:body>([\s\S]*)<\/w:body>/);
        let textParagraphs = '';
        if (bodyMatch) {
            textParagraphs = bodyMatch[1]
                .replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, '')
                .trim();
        }

        // ══════════════════════════════════════════════════
        // STEP 3: Open the Vagarious template
        // ══════════════════════════════════════════════════
        const templateUrl = 'https://res.cloudinary.com/dm0qq5no9/raw/upload/v1775132006/Vagerious_new.docx';
        const response = await fetch(templateUrl);
        if (!response.ok) throw new Error('Failed to fetch template from Cloudinary');
        const arrayBuffer = await response.arrayBuffer();
        const templateZip = new AdmZip(Buffer.from(arrayBuffer));
        let templateDocXml = templateZip.readAsText('word/document.xml');

        // ── Disable Word image compression ──
        let settingsXml = templateZip.readAsText('word/settings.xml');
        if (!settingsXml.includes('doNotCompressPictures')) {
            settingsXml = settingsXml.replace(
                '</w:settings>',
                `  <w:doNotCompressPictures/>\n  <w:compat>\n    <w:doNotExpandShiftReturn/>\n  </w:compat>\n</w:settings>`
            );
            templateZip.updateFile('word/settings.xml', Buffer.from(settingsXml, 'utf8'));
        }

        // ══════════════════════════════════════════════════
        // STEP 4: Extract the logo paragraph from the template
        // ══════════════════════════════════════════════════
        // Try to find a paragraph containing a drawing (the logo image).
        // Falls back to any first paragraph if no drawing found.
        const logoParaMatch =
            templateDocXml.match(/<w:p\b[^>]*>(?:(?!<w:p\b).)*?<w:drawing>[\s\S]*?<\/w:drawing>[\s\S]*?<\/w:p>/) ||
            templateDocXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);

        if (!logoParaMatch) {
            throw new Error('Could not find logo paragraph in template. Check Vagerious_new.docx.');
        }

        const logoPara = logoParaMatch[0];

        // Remove logo from its original position — we'll re-inject it per section
        templateDocXml = templateDocXml.replace(logoPara, '');

        // ══════════════════════════════════════════════════
        // STEP 5: Calculate pages and split paragraphs
        // ══════════════════════════════════════════════════
        // ~350 words per page is a safe estimate for A4 with normal margins.
        // Minimum 1 page, maximum capped at 10 to avoid runaway sections.
        const estimatedPages = Math.min(10, Math.max(1, Math.ceil(wordCount / 350)));

        const allParas = textParagraphs.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
        const parasPerPage = Math.ceil(allParas.length / estimatedPages);

        // ══════════════════════════════════════════════════
        // STEP 6: Build multi-section body
        // ══════════════════════════════════════════════════
        // Structure per section:
        //   [logoPara]           ← body image, always sharp
        //   [content paragraphs] ← agreement text for this page
        //   [sectPr]             ← page break (except last section)
        //
        // Word rule: mid-document sectPr must be wrapped in <w:p><w:pPr>...</w:pPr></w:p>
        // The LAST section's sectPr goes directly in <w:body> (not in a paragraph).

        let multiSectionBody = '';

        for (let i = 0; i < estimatedPages; i++) {
            const chunk = allParas
                .slice(i * parasPerPage, (i + 1) * parasPerPage)
                .join('\n');

            const isLast = i === estimatedPages - 1;

            // Page size: A4 (11900 × 16840 twips)
            // Top margin 2800 = ~2 inches — leaves space below the logo image.
            // Adjust w:top if your logo is taller/shorter.
            const pgMar = `w:top="2800" w:right="1000" w:bottom="2080" w:left="1000" w:header="720" w:footer="720" w:gutter="0"`;
            const pgSz = `w:w="11900" w:h="16840" w:orient="portrait"`;

            if (isLast) {
                // Last section: sectPr goes directly in body — no wrapper paragraph
                multiSectionBody += logoPara + '\n' + chunk + '\n';
                multiSectionBody += `<w:sectPr>
  <w:pgSz ${pgSz}/>
  <w:pgMar ${pgMar}/>
</w:sectPr>`;
            } else {
                // Mid-document section: sectPr must be inside <w:p><w:pPr>
                multiSectionBody += logoPara + '\n' + chunk + '\n';
                multiSectionBody += `<w:p>
  <w:pPr>
    <w:sectPr>
      <w:type w:val="nextPage"/>
      <w:pgSz ${pgSz}/>
      <w:pgMar ${pgMar}/>
    </w:sectPr>
  </w:pPr>
</w:p>`;
            }
        }

        // ══════════════════════════════════════════════════
        // STEP 7: Inject multi-section body into template
        // ══════════════════════════════════════════════════
        // Replace the existing sectPr (which is now the only thing left
        // in the body after we removed the logoPara above).
        const hasSectPr = /<w:sectPr[\s\S]*?<\/w:sectPr>/.test(templateDocXml);
        if (hasSectPr) {
            templateDocXml = templateDocXml.replace(
                /<w:sectPr[\s\S]*?<\/w:sectPr>/,
                multiSectionBody
            );
        } else {
            // No sectPr found — inject before closing </w:body>
            templateDocXml = templateDocXml.replace(
                '</w:body>',
                multiSectionBody + '</w:body>'
            );
        }

        templateZip.updateFile('word/document.xml', Buffer.from(templateDocXml, 'utf8'));

        // ══════════════════════════════════════════════════
        // STEP 8: Copy styles from generated DOCX into template
        // ══════════════════════════════════════════════════
        // This ensures font sizes, bold, alignment from html-to-docx carry over.
        const stylesToCopy = ['word/styles.xml', 'word/webSettings.xml'];
        for (const f of stylesToCopy) {
            const entry = textZip.getEntry(f);
            if (entry) templateZip.updateFile(f, entry.getData());
        }

        // ── Copy numbering.xml if bullet lists are present ──
        const numEntry = textZip.getEntry('word/numbering.xml');
        if (numEntry) {
            templateZip.addFile('word/numbering.xml', numEntry.getData());

            let ctXml = templateZip.readAsText('[Content_Types].xml');
            if (!ctXml.includes('numbering.xml')) {
                ctXml = ctXml.replace(
                    '</Types>',
                    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>'
                );
                templateZip.updateFile('[Content_Types].xml', Buffer.from(ctXml, 'utf8'));
            }

            let dRels = templateZip.readAsText('word/_rels/document.xml.rels');
            if (!dRels.includes('numbering.xml')) {
                dRels = dRels.replace(
                    '</Relationships>',
                    '<Relationship Id="rIdNum1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>'
                );
                templateZip.updateFile('word/_rels/document.xml.rels', Buffer.from(dRels, 'utf8'));
            }
        }

        // ══════════════════════════════════════════════════
        // STEP 9: Send final DOCX
        // ══════════════════════════════════════════════════
        const finalBuffer = templateZip.toBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename="Vagarious_Agreement.docx"');
        res.send(finalBuffer);

    } catch (err) {
        console.error('DOCX Generation Error:', err);
        res.status(500).json({ detail: err.message });
    }
});

export default router;