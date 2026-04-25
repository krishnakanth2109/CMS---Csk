async function sendBrevoEmail({ toEmail, toName, subject, htmlContent, attachment = [] }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME || "Arah Info Tech Pvt ltd";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "career.arahinfotech@gmail.com";

  if (!apiKey || !senderEmail) {
    console.error("[Brevo] CRITICAL: Missing API key or Sender Email.");
    return false;
  }

  try {
    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject,
      htmlContent,
      ...(attachment.length > 0 ? { attachment } : {})
    };

    // Use AbortController for a 20-second timeout to prevent 2-minute hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Brevo] API Error: ${response.status} ${response.statusText}`, JSON.stringify(errorData, null, 2));
      return false;
    }

    return true;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error("[Brevo] Error: Request timed out after 20 seconds.");
    } else {
      console.error("[Brevo] Network/Fetch Error:", error.message);
    }
    return false;
  }
}

import PDFDocument from 'pdfkit';

async function generatePdfBase64(text, title = "Job Description") {
  return new Promise((resolve, reject) => {
    try {
       const doc = new PDFDocument({ margin: 50 });
       const chunks = [];
       doc.on('data', chunk => chunks.push(chunk));
       doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
       
       // PDF Content
       doc.fillColor('#6366f1').fontSize(24).font('Helvetica-Bold').text(title, { align: 'center' });
       doc.moveDown(1);
       doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
       doc.moveDown(1.5);
       
       doc.fillColor('#334155').fontSize(11).font('Helvetica').text(text, {
         align: 'left',
         lineGap: 5
       });
       
       doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function sendInterviewEmail({ candidateEmail, candidateName, linkUrl, duration, jobDescription, resumeText }) {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5000";
  
  // Decide which text to use for the PDF
  // If jobDescription is not "JD provided via attached file", use it.
  // Otherwise, use resumeText (which contains the parsed PDF text).
  const isGenericJdStr = String(jobDescription || "").includes("JD provided via attached file");
  const finalJdText = isGenericJdStr ? (resumeText || jobDescription) : (jobDescription || resumeText);
  
  let attachments = [];
  if (finalJdText) {
    try {
      const base64 = await generatePdfBase64(finalJdText);
      attachments.push({
        content: base64,
        name: "Job_Description.pdf"
      });
    } catch (err) {
      console.error("[Email Service] PDF generation failed", err);
    }
  }

  return sendBrevoEmail({
    toEmail: candidateEmail,
    toName: candidateName,
    subject: "Interview Invitation by Arah",
    attachment: attachments,
    htmlContent: `
      <html>
      <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 25px;">
           <h1 style="color: #6366f1; margin-bottom: 5px;">Interview Invitation</h1>
           <p style="color: #64748b; font-size: 1.1rem; margin-top: 0;">AI-Powered Assessment by <b>Arah</b></p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <p>Dear <b>${candidateName}</b>,</p>
          <p>We are excited to invite you to complete an AI-powered technical interview. This assessment will help us understand your skills and experience better.</p>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border-radius: 12px; border-left: 4px solid #6366f1;">
            <p style="margin: 5px 0;"><b>Important:</b> We have attached the <b>Job Description PDF</b> to this email for your reference.</p>
            <p style="margin: 5px 0;"><b>Interview Duration:</b> <span style="color: #6366f1; font-weight: bold;">${duration} minutes</span></p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}${linkUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 1.1rem; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);">
              🚀 Start Interview Now
            </a>
          </div>

          <p style="font-size: 0.85rem; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            <b>Important:</b> This invitation link is personal and will expire in <b>24 hours</b>.
          </p>
        </div>
        
        <p style="text-align: center; color: #64748b; font-size: 0.85rem; margin-top: 20px;">
          Best of luck!<br/><b>Arah Recruitment Team</b>
        </p>
      </body>
      </html>
    `
  });
}

async function sendOtpEmail({ email, name, otp }) {
  return sendBrevoEmail({
    toEmail: email,
    toName: name,
    subject: "Admin Password Reset OTP",
    htmlContent: `
      <html>
      <body>
        <h3>Password Reset Request</h3>
        <p>Dear ${name},</p>
        <p>You requested to reset your admin password. Please use the following One-Time Password (OTP) to proceed:</p>
        <h2 style="color: #6366f1; letter-spacing: 5px; font-size: 2rem;">${otp}</h2>
        <p>This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        <p>Best Regards,<br/>Arah Info Tech Pvt ltd</p>
      </body>
      </html>
    `
  });
}

async function sendDecisionEmail({ email, name, decision, overallRecommendation, avgScore, strengths, weaknesses }) {
  const status = String(decision || "").toLowerCase();
  const subject =
    status === "selected"
      ? "Interview Result - Invitation for next steps"
      : "Application Status Update";

  const summaryHtml = `
    <div style="margin-top: 25px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-family: sans-serif;">
      <h3 style="margin-top: 0; color: #1e293b; border-bottom: 2px solid #6366f1; padding-bottom: 8px; display: inline-block;">Interview Performance Summary</h3>
      <div style="margin: 15px 0;">
        <p style="margin: 5px 0;"><b>Overall Recommendation:</b> <span style="color: ${status === 'selected' ? '#10b981' : '#e11d48'}; font-weight: bold;">${overallRecommendation || 'Reviewed'}</span></p>
        <p style="margin: 5px 0;"><b>Average AI Score:</b> <span style="color: #6366f1; font-weight: bold;">${avgScore || 0}/100</span></p>
      </div>
      
      <div style="margin-top: 15px;">
        <h4 style="margin-bottom: 5px; color: #059669;">Key Strengths:</h4>
        <p style="margin: 0; color: #475569; font-size: 0.95rem;">${strengths || 'Consistent performance across technical domains.'}</p>
      </div>

      <div style="margin-top: 15px;">
        <h4 style="margin-bottom: 5px; color: #e11d48;">Areas for Improvement:</h4>
        <p style="margin: 0; color: #475569; font-size: 0.95rem;">${weaknesses || 'Continue strengthening core foundational concepts.'}</p>
      </div>
    </div>
  `;

  const htmlContent =
    status === "selected"
      ? `
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1;">Congratulations ${name}!</h2>
          <p>We are pleased to inform you that you have successfully cleared the AI interview for the role at <b>Arah Info Tech</b>.</p>
          <p>Our recruitment team has reviewed your performance dashboard and we were quite impressed with your responses.</p>
          
          ${summaryHtml}

          <p style="margin-top: 25px;"><b>Next Steps:</b> We would like to invite you for a final technical discussion with our team. We will be in touch shortly to schedule the call.</p>
          <p>Best Regards,<br/><b>Arah Recruitment Team</b></p>
        </body>
        </html>
      `
      : `
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Application Update</h2>
          <p>Dear ${name},</p>
          <p>Thank you for taking the time to complete the AI interview with us. After careful consideration and review of your interview dashboard, we have decided not to move forward with your application for this specific position at this time.</p>
          
          ${summaryHtml}

          <p style="margin-top: 25px;">We were impressed by your background and will keep your profile in our database for future opportunities that align with your skills.</p>
          <p>We wish you the very best in your professional journey.</p>
          <p>Best Regards,<br/><b>Arah Recruitment Team</b></p>
        </body>
        </html>
      `;

  return sendBrevoEmail({
    toEmail: email,
    toName: name,
    subject,
    htmlContent
  });
}

export { 
  sendBrevoEmail,
  sendDecisionEmail,
  sendInterviewEmail,
  sendOtpEmail
 };
