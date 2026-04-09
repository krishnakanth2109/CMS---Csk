const htmlToDocx = require('html-to-docx');
const AdmZip = require('adm-zip');

const safeHtml = `
          <table width='100%' border='1' cellpadding='3' cellspacing='0' style='width: 100%; table-layout: fixed; border-collapse: collapse; text-align: center; font-size: 9pt; margin-bottom: 8pt; border: 1px solid #000;'>
            <thead>
              <tr style='font-weight: bold; background-color: #f3f4f6;'>
                <td width='40' style='width: 40pt; border: 1px solid #000;'>S.No</td>
              </tr>
            </thead>
          </table>
`;

(async () => {
    let htmlDocxBuffer = await htmlToDocx(safeHtml, null, { margins: { top: 2200 } });
    const textZip = new AdmZip(htmlDocxBuffer);
    let xml = textZip.readAsText('word/document.xml');
    
    // Look for bad XML attributes
    console.log("Checking for @w...");
    if (xml.includes('@w')) {
        console.log("FOUND @w IN OUTPUT:");
        let idx = xml.indexOf('@w');
        console.log(xml.substring(idx - 50, idx + 50));
    } else {
        console.log("NO @w FOUND");
    }
})();
