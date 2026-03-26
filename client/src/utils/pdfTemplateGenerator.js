/**
 * PDF Template Generator — Smart Canvas Slicing with Section-Aware Page Breaks
 *
 * Handles Agreements properly by:
 * 1. Using template-specific margin configs (header/footer safe zones)
 * 2. Smart page breaks that never cut through section headings
 * 3. 1px CSS = 1pt PDF mapping for pixel-perfect alignment
 * 4. Transparent background so template shows through
 *
 * @param {string} htmlContent - The agreement HTML content.
 * @param {string} templateUrl - URL to the template image (JPG/PNG) or PDF.
 * @returns {Promise<string>} - Base64 Data URI of the final PDF.
 */

export const generatePdfWithTemplate = async (htmlContent, templateUrl = '/Arah_Template.pdf') => {
    try {
        const { PDFDocument } = await import('pdf-lib');
        const html2canvas = (await import('html2canvas')).default;

        // ── Template-specific configurations ──────────────────────────
        const TEMPLATE_CONFIG = {
            '/Arah_Template.pdf': {
                pageW: 612, pageH: 792, marginTop: 111, marginBottom: 57, marginLR: 50,
                watermark: 'ARAH INFOTECH'
            },
            '/Arah_Template.jpg': {
                pageW: 612, pageH: 792, marginTop: 111, marginBottom: 57, marginLR: 50,
                watermark: 'ARAH INFOTECH'
            },
            '/Vagerious.pdf': {
                pageW: 595, pageH: 842, marginTop: 140, marginBottom: 104, marginLR: 50,
                watermark: 'VAGARIOUS'
            },
            '/UPlife.pdf': {
                pageW: 596, pageH: 842, marginTop: 99, marginBottom: 78, marginLR: 50,
                watermark: 'UP LIFE INDIA'
            },
            '/Zero7_A4.pdf': {
                pageW: 595, pageH: 842, marginTop: 140, marginBottom: 101, marginLR: 50,
                watermark: 'ZERO7'
            },
            '/Zero7_A4.jpg': {
                pageW: 595, pageH: 842, marginTop: 140, marginBottom: 101, marginLR: 50,
                watermark: 'ZERO7'
            },
        };

        const cfg = TEMPLATE_CONFIG[templateUrl] || {
            pageW: 612, pageH: 792, marginTop: 110, marginBottom: 60, marginLR: 50
        };

        const PAGE_W = cfg.pageW;
        const PAGE_H = cfg.pageH;
        const MARGIN_TOP = cfg.marginTop;
        const MARGIN_BOTTOM = cfg.marginBottom;
        const MARGIN_LR = cfg.marginLR;
        const CONTENT_W = PAGE_W - (MARGIN_LR * 2);
        const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

        const CONTAINER_W = Math.round(CONTENT_W);
        const SCALE = 2;

        console.log(`[PDF GEN] Template: ${templateUrl}`);
        console.log(`[PDF GEN] Page: ${PAGE_W}×${PAGE_H}, Content: ${CONTENT_W}×${CONTENT_H}, Container: ${CONTAINER_W}px`);

        const isDense = htmlContent.length > 2500 ||
            htmlContent.includes('REMUNERATION') ||
            htmlContent.includes('Annexure') ||
            htmlContent.includes('Salary Structure');

        const isAgreement = htmlContent.includes('AGREEMENT') ||
            htmlContent.includes('RECITALS') ||
            htmlContent.includes('CONTRACT TERM') ||
            htmlContent.includes('section-block');

        const fontSize = isDense ? '11px' : (isAgreement ? '12px' : '14px');
        const lineHeight = isDense ? '1.45' : (isAgreement ? '1.6' : '1.7');

        // ════════════════════════════════════════════════════════════════
        // STEP 1 — Build DOM container (1px = 1pt mapping)
        // ════════════════════════════════════════════════════════════════
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: ${CONTAINER_W}px;
            z-index: -9999;
            background: transparent;
            overflow: visible;
        `;

        const styleTag = document.createElement('style');
        styleTag.textContent = `
            .pdfgen * {
                font-family: Arial, Helvetica, sans-serif !important;
                color: #000000 !important;
                -webkit-text-fill-color: #000000 !important;
                box-sizing: border-box !important;
            }
            .pdfgen {
                width: ${CONTAINER_W}px !important;
                background: transparent !important;
                padding: 0 8px !important;
                font-size: ${fontSize} !important;
                line-height: ${lineHeight} !important;
            }
            .pdfgen p {
                margin-bottom: ${isDense ? '5px' : (isAgreement ? '6px' : '10px')} !important;
                text-align: justify !important;
            }
            .pdfgen h1, .pdfgen h2, .pdfgen h3, .pdfgen h4,
            .pdfgen strong, .pdfgen b {
                margin-top: ${isDense ? '10px' : '14px'} !important;
                margin-bottom: 4px !important;
            }
            .pdfgen h3 {
                font-size: ${parseInt(fontSize) + 1}px !important;
                text-transform: uppercase;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                text-align: center !important;
            }
            .pdfgen h4 {
                font-size: ${parseInt(fontSize) + 1}px !important;
            }
            .pdfgen table {
                width: 100% !important;
                border-collapse: collapse !important;
                font-size: ${isDense ? '10px' : '11px'} !important;
                margin: 8px 0 !important;
            }
            .pdfgen td, .pdfgen th { padding: 4px !important; }
            .pdfgen table:not([style*="border: none"]) td,
            .pdfgen table:not([style*="border: none"]) th {
                border: 1px solid #000 !important;
            }
            .pdfgen ul, .pdfgen ol {
                padding-left: 18px !important;
                margin-top: 2px !important;
                margin-bottom: 5px !important;
            }
            .pdfgen li { margin-bottom: 2px !important; }
            .pdfgen .section-block {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .pdfgen .date-row {
                display: flex; justify-content: flex-end;
                align-items: center;
                margin-bottom: ${isDense ? '5px' : '15px'} !important;
            }
            .pdfgen img {
                display: block !important;
                border: none !important;
                outline: none !important;
                box-shadow: none !important;
            }
        `;

        const container = document.createElement('div');
        container.className = 'pdfgen';
        container.style.position = 'relative';

        // Remove trailing empty paragraphs or breaks
        let cleanHtml = htmlContent;
        let prevLen = -1;
        while (cleanHtml.length !== prevLen) {
            prevLen = cleanHtml.length;
            cleanHtml = cleanHtml.replace(/(?:<p>(?:\s|<br\s*\/?>|&nbsp;)*<\/p>\s*)+$/gi, '')
                .replace(/(?:<br\s*\/?>\s*)+$/gi, '')
                .trim();
        }

        container.innerHTML = cleanHtml;

        wrapper.appendChild(styleTag);
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);

        // Force solid black text on every element
        container.querySelectorAll('*').forEach(el => {
            el.style.color = '#000000';
            el.style.webkitTextFillColor = '#000000';
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'TH'].includes(el.tagName)) {
                el.style.fontWeight = 'bold';
            }
        });

        // Wait for fonts/images to render
        await new Promise(r => setTimeout(r, 500));

        // ════════════════════════════════════════════════════════════════
        // STEP 2 — Calculate smart page breaks (section-aware) & True Height
        // ════════════════════════════════════════════════════════════════

        let trueBottom = 0;
        const containerRect = container.getBoundingClientRect();
        const allNodes = Array.from(container.querySelectorAll('*'));
        for (const el of allNodes) {
            if (['BR', 'STYLE', 'SCRIPT'].includes(el.tagName)) continue;

            const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
            if (hasDirectText || ['IMG', 'HR', 'TABLE', 'TD', 'TH', 'LI'].includes(el.tagName)) {
                const rect = el.getBoundingClientRect();
                const bottomRel = rect.bottom - containerRect.top;
                if (bottomRel > trueBottom) {
                    trueBottom = bottomRel;
                }
            }
        }

        const totalHeight = trueBottom > 0 ? trueBottom + 5 : container.scrollHeight;

        console.log(`[PDF GEN] Container scrollHeight: ${container.scrollHeight}px, True Visible Height: ${totalHeight}px, Content/page: ${CONTENT_H}px`);

        const headings = Array.from(container.querySelectorAll('h4, .section-block'));
        const sectionYs = headings.map(h => h.offsetTop);

        const pageBreaks = [0];
        let currentY = 0;

        while (currentY + CONTENT_H < totalHeight - 15) {
            let idealBreak = currentY + CONTENT_H;
            let bestBreak = idealBreak;

            for (const sy of sectionYs) {
                if (sy > currentY + CONTENT_H * 0.3 && sy <= idealBreak) {
                    bestBreak = sy - 5;
                }
            }

            for (let i = 0; i < headings.length; i++) {
                const hTop = sectionYs[i];
                const hBottom = i + 1 < sectionYs.length ? sectionYs[i + 1] : totalHeight;
                const sectionHeight = hBottom - hTop;

                if (hTop > currentY && hTop < idealBreak && hBottom > idealBreak) {
                    if (sectionHeight <= CONTENT_H) {
                        bestBreak = Math.min(bestBreak, hTop - 5);
                    }
                }
            }

            if (bestBreak <= currentY + CONTENT_H * 0.5) {
                bestBreak = idealBreak;
            }

            pageBreaks.push(bestBreak);
            currentY = bestBreak;
        }

        const numPages = pageBreaks.length;
        console.log(`[PDF GEN] Smart page breaks:`, pageBreaks, `→ ${numPages} pages`);

        // ════════════════════════════════════════════════════════════════
        // STEP 3 — Capture canvas with html2canvas
        // ════════════════════════════════════════════════════════════════
        const canvas = await html2canvas(container, {
            scale: SCALE,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: null,
            width: CONTAINER_W,
            height: totalHeight,
            windowWidth: CONTAINER_W,
        });

        document.body.removeChild(wrapper);
        console.log(`[PDF GEN] Canvas: ${canvas.width}×${canvas.height}`);

        // ════════════════════════════════════════════════════════════════
        // STEP 4 — Slice canvas into pages and build PDF
        // ════════════════════════════════════════════════════════════════
        const finalDoc = await PDFDocument.create();

        // Load template
        const isImage = /\.(jpg|jpeg|png)$/i.test(templateUrl);
        let templateImage = null;
        let templatePdfDoc = null;
        let templatePage = null;

        if (isImage) {
            const imgRes = await fetch(`${templateUrl}?t=${Date.now()}`);
            const ct = imgRes.headers.get('content-type');
            if (!imgRes.ok || (ct && ct.includes('text/html'))) {
                throw new Error(`Template image not found: ${templateUrl}`);
            }
            const imageBytes = await imgRes.arrayBuffer();
            const hdr = new Uint8Array(imageBytes.slice(0, 4));
            if (hdr[0] === 0x25 && hdr[1] === 0x50 && hdr[2] === 0x44 && hdr[3] === 0x46) {
                throw new Error(`File '${templateUrl}' is a PDF renamed as image.`);
            }
            templateImage = templateUrl.toLowerCase().endsWith('.png')
                ? await finalDoc.embedPng(imageBytes)
                : await (async () => {
                    try { return await finalDoc.embedJpg(imageBytes); }
                    catch { return await finalDoc.embedPng(imageBytes); }
                })();
        } else {
            const templateRes = await fetch(`${templateUrl}?t=${Date.now()}`);
            if (!templateRes.ok) throw new Error(`Template PDF not found: ${templateUrl}`);
            templatePdfDoc = await PDFDocument.load(await templateRes.arrayBuffer());
            const [embeddedPage] = await finalDoc.embedPdf(templatePdfDoc, [0]);
            templatePage = embeddedPage;
        }

        // Process each page
        for (let i = 0; i < numPages; i++) {
            const sliceStartPx = pageBreaks[i];
            const sliceEndPx = i + 1 < numPages ? pageBreaks[i + 1] : totalHeight;
            const sliceHeightPx = sliceEndPx - sliceStartPx;

            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = Math.ceil(sliceHeightPx * SCALE);
            const ctx = sliceCanvas.getContext('2d');

            ctx.drawImage(
                canvas,
                0, Math.floor(sliceStartPx * SCALE),
                canvas.width, Math.ceil(sliceHeightPx * SCALE),
                0, 0,
                canvas.width, Math.ceil(sliceHeightPx * SCALE)
            );

            const slicePng = sliceCanvas.toDataURL('image/png');
            const slicePngBytes = Uint8Array.from(
                atob(slicePng.split(',')[1]),
                c => c.charCodeAt(0)
            );

            const embeddedSlice = await finalDoc.embedPng(slicePngBytes);

            const page = finalDoc.addPage([PAGE_W, PAGE_H]);

            if (templateImage) {
                page.drawImage(templateImage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
            } else if (templatePage) {
                page.drawPage(templatePage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
            }

            const sliceWidthPt = CONTENT_W;
            const sliceHeightPt = Math.min(sliceHeightPx, CONTENT_H);

            page.drawImage(embeddedSlice, {
                x: MARGIN_LR,
                y: PAGE_H - MARGIN_TOP - sliceHeightPt,
                width: sliceWidthPt,
                height: sliceHeightPt,
            });

            // Watermark
            if (cfg.watermark) {
                const { rgb, degrees, StandardFonts } = await import('pdf-lib');
                const watermarkFont = await finalDoc.embedFont(StandardFonts.HelveticaBold);
                const wmText = cfg.watermark;
                const wmFontSize = 60;
                const wmWidth = watermarkFont.widthOfTextAtSize(wmText, wmFontSize);
                const wmHeight = watermarkFont.heightAtSize(wmFontSize);

                page.drawText(wmText, {
                    x: PAGE_W / 2 - wmWidth / 2,
                    y: PAGE_H / 2 - wmHeight / 2,
                    size: wmFontSize,
                    font: watermarkFont,
                    color: rgb(0.75, 0.75, 0.75),
                    opacity: 0.06,
                    rotate: degrees(45),
                });
            }
        }

        console.log(`[PDF GEN] Final PDF: ${finalDoc.getPageCount()} pages`);
        return _pdfBytesToDataUri(await finalDoc.save());

    } catch (err) {
        console.error('[PDF GEN] Error:', err);
        throw err;
    }
};

function _pdfBytesToDataUri(pdfBytes) {
    const bytes = new Uint8Array(pdfBytes);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return 'data:application/pdf;base64,' + window.btoa(binary);
}
