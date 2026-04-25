const htmlToDocx = require('html-to-docx');
const AdmZip = require('adm-zip');

const safeHtml = `
  <table width='100%' border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse; text-align: center; font-size: 12px; margin-bottom: 20px; border: 1px solid #000;'>
    <tr><td>S.No</td><td>Candidate Name</td></tr>
    <tr><td>1</td><td>Lahari Ganta</td></tr>
  </table>
`;

(async () => {
    let htmlDocxBuffer;
    try {
        htmlDocxBuffer = await htmlToDocx(safeHtml, null, {
            margins: { top: 2800, right: 1000, bottom: 2080, left: 1000 }
        });
    } catch(e) {
        console.error(e);
        return;
    }
    const textZip = new AdmZip(htmlDocxBuffer);
    let textDocXml = textZip.readAsText('word/document.xml');
    
    const bodyMatch = textDocXml.match(/<w:body>([\s\S]*)<\/w:body>/);
    const textParagraphs = bodyMatch[1].replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, '').trim();
    
    console.log(textParagraphs.includes('<w:tbl>') ? 'TABLE INTACT' : 'TABLE MISSING');
    console.log('--- XML START ---');
    console.log(textParagraphs);
    console.log('--- XML END ---');
})();
