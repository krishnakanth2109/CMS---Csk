import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

async function generateInterviewReport({ interviewId, source, date, answers, outputDir }) {
  await fs.promises.mkdir(outputDir, { recursive: true });

  const filePath = path.join(outputDir, `Interview_Report_${interviewId}.pdf`);
  const document = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  document.pipe(stream);

  document.fontSize(20).text("Interview Report", { underline: true });
  document.moveDown();
  document.fontSize(11).text(`Interview ID: ${interviewId}`);
  document.text(`Date: ${date || "N/A"}`);
  document.text(`Source: ${source || "N/A"}`);
  
  if (arguments[0].decision) {
    const dec = arguments[0].decision.toUpperCase();
    document.moveDown(0.5);
    document.fontSize(12).fillColor(dec === 'SELECTED' ? '#10b981' : '#ef4444').text(`Status: ${dec === 'SELECTED' ? 'ACCEPTED' : 'REJECTED'}`).fillColor('#333333');
  }

  const scores = answers.map((entry) => Number(entry.ai_score)).filter((score) => Number.isFinite(score));
  const average = scores.length > 0 ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : "N/A";
  document.moveDown();
  document.fontSize(12).text(`Overall Score: ${average}`);
  document.moveDown();

  answers.forEach((entry, index) => {
    document.fontSize(13).text(`Q${index + 1}: ${entry.question_text}`, { underline: true });
    document.moveDown(0.3);
    document.fontSize(11).text(`Your Answer: ${entry.answer_text || "(No answer recorded)"}`);
    document.moveDown(0.2);
    document.text(`Score: ${entry.ai_score ?? "N/A"}/100`);
    document.moveDown(0.2);
    document.text(`Feedback: ${entry.ai_feedback || "No feedback provided."}`);
    if (entry.corrected_answer) {
      document.moveDown(0.2);
      document.text(`Suggested Answer: ${entry.corrected_answer}`);
    }
    document.moveDown();
    document.moveTo(50, document.y).lineTo(545, document.y).strokeColor("#cccccc").stroke();
    document.moveDown();
  });

  document.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return filePath;
}

export { 
  generateInterviewReport
 };
