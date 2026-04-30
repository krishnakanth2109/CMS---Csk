import PDFDocument from 'pdfkit';

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const normalizeDecisionStatus = (decision) => {
  const status = String(decision || "").trim().toLowerCase();
  if (["selected", "accepted", "accept", "approved", "approve"].includes(status)) {
    return "selected";
  }
  if (["rejected", "reject", "declined", "decline"].includes(status)) {
    return "rejected";
  }
  return status;
};

const joinUrl = (baseUrl, pathUrl) => {
  const cleanBase = String(baseUrl || "").replace(/\/+$/, "");
  const cleanPath = String(pathUrl || "").startsWith("/") ? String(pathUrl || "") : `/${pathUrl || ""}`;
  return `${cleanBase}${cleanPath}`;
};

const brevoResult = (ok, message, providerStatus = null, providerResponse = null) => ({
  ok,
  message,
  providerStatus,
  providerResponse
});

async function sendBrevoEmailDetailed({ toEmail, toName, subject, htmlContent, attachment = [] }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME || "Arah Info Tech Pvt ltd";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "career.arahinfotech@gmail.com";
  const recipientEmail = String(toEmail || '').trim();
  const recipientName = String(toName || recipientEmail).trim();

  if (!apiKey || !senderEmail) {
    console.error("[Brevo] CRITICAL: Missing API key or Sender Email in .env");
    return brevoResult(false, "Missing BREVO_API_KEY or BREVO_SENDER_EMAIL in backend .env");
  }

  if (!isValidEmail(recipientEmail)) {
    console.error(`[Brevo] Invalid recipient email: ${toEmail || '(empty)'}`);
    return brevoResult(false, `Invalid recipient email: ${toEmail || '(empty)'}`);
  }

  console.log(`[Brevo] Preparing to send email to: ${recipientEmail} | Subject: ${subject}`);

  try {
    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: recipientEmail, name: recipientName }],
      subject,
      htmlContent,
      ...(attachment.length > 0 ? { attachment } : {})
    };

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
      console.error(`[Brevo] API REJECTION (${response.status}) for ${recipientEmail}:`, JSON.stringify(errorData, null, 2));
      const providerMessage = errorData.message || errorData.code || response.statusText || "Brevo rejected the request";
      return brevoResult(false, providerMessage, response.status, errorData);
    }

    const resultData = await response.json().catch(() => ({}));
    console.log(`[Brevo] Email DISPATCHED successfully to ${recipientEmail}. MessageID: ${resultData.messageId || 'N/A'}`);
    return brevoResult(true, "Email dispatched successfully", response.status, resultData);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error("[Brevo] TIMEOUT: Request took longer than 20s.");
      return brevoResult(false, "Brevo request timed out after 20 seconds. Check your internet connection or Brevo API status.");
    } else {
      console.error("[Brevo] EXCEPTION:", error.message);
      let msg = error.message || "Brevo request failed";
      if (msg.includes("fetch failed")) {
        msg = "Network error: Failed to reach Brevo API. Check server internet access.";
      }
      return brevoResult(false, msg);
    }
  }
}

async function sendBrevoEmail(options) {
  const result = await sendBrevoEmailDetailed(options);
  return result.ok;
}

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

async function buildInterviewEmail({ candidateEmail, candidateName, linkUrl, duration, jobDescription, resumeText, skipPdf = false, customBody = "" }) {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5000";
  const fullLink = baseUrl.startsWith("http") ? joinUrl(baseUrl, linkUrl) : joinUrl("http://localhost:5173", linkUrl);
  
  // Decide which text to use for the PDF
  const isGenericJdStr = String(jobDescription || "").includes("JD provided via attached file");
  const finalJdText = isGenericJdStr ? (resumeText || jobDescription) : (jobDescription || resumeText);
  
  let attachments = [];
  if (!skipPdf && finalJdText) {
    try {
      const base64 = await generatePdfBase64(finalJdText);
      attachments.push({
        content: base64,
        name: "Job_Description.pdf"
      });
    } catch (err) {
      console.error("[EmailPDF] Generation failed:", err.message);
    }
  }

  // If customBody is provided from the frontend editor, wrap it in our shell
  let htmlBody = "";
  if (customBody) {
     // Inject name and link into the custom body if placeholders exist
     const hasLinkPlaceholder = String(customBody).includes("{link}");
     let processedBody = customBody
        .replace(/{name}/g, candidateName)
        .replace(/{link}/g, fullLink)
        .replace(/\n/g, '<br/>');

     if (!hasLinkPlaceholder) {
        processedBody += `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${fullLink}" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Start Interview
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b; text-align: center;">If the button above doesn't work, copy and paste this link: <br/> ${fullLink}</p>
        `;
     }

     htmlBody = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
        <div style="background-color: #6366f1; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Interview Invitation</h1>
        </div>
        <div style="padding: 30px;">
          ${processedBody}
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">© ${new Date().getFullYear()} Arah Info Tech. All rights reserved.</p>
        </div>
      </div>
     `;
  } else {
    // Default template
    htmlBody = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
      <div style="background-color: #6366f1; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Interview Invitation</h1>
      </div>
      <div style="padding: 30px;">
        <p>Dear <b>${candidateName}</b>,</p>
        <p>We are excited to invite you to complete an AI-powered technical interview. This assessment will help us understand your skills and experience better.</p>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border-radius: 12px; border-left: 4px solid #6366f1;">
          <p style="margin: 5px 0;"><b>Important:</b> A PDF reference is attached for your review.</p>
          <p style="margin: 5px 0;"><b>Interview Duration:</b> <span style="color: #6366f1; font-weight: bold;">${duration} minutes</span></p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${fullLink}" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            🚀 Start Interview Now
          </a>
        </div>

        <p style="font-size: 12px; color: #64748b; text-align: center;">If the button above doesn't work, copy and paste this link: <br/> ${fullLink}</p>
        
        <p>Best of luck!<br/><b>Arah Recruitment Team</b></p>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #64748b;">© ${new Date().getFullYear()} Arah Info Tech. All rights reserved.</p>
      </div>
    </div>
    `;
  }

  return {
    toEmail: candidateEmail,
    toName: candidateName,
    subject: "Interview Invitation - Arah Info Tech",
    htmlContent: htmlBody,
    attachment: attachments
  };
}

async function sendInterviewEmailDetailed(options) {
  return sendBrevoEmailDetailed(await buildInterviewEmail(options));
}

async function sendInterviewEmail(options) {
  const result = await sendInterviewEmailDetailed(options);
  return result.ok;
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

function buildDecisionEmail({ email, name, decision, overallRecommendation, avgScore, strengths, weaknesses }) {
  const status = normalizeDecisionStatus(decision);
  const subject =
    status === "selected"
      ? "Interview Result - Accepted for next steps"
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

  return {
    toEmail: email,
    toName: name,
    subject,
    htmlContent
  };
}

async function sendDecisionEmailDetailed(options) {
  return sendBrevoEmailDetailed(buildDecisionEmail(options));
}

async function sendDecisionEmail(options) {
  const result = await sendDecisionEmailDetailed(options);
  return result.ok;
}

export { 
  isValidEmail,
  normalizeDecisionStatus,
  sendBrevoEmail,
  sendBrevoEmailDetailed,
  sendDecisionEmail,
  sendDecisionEmailDetailed,
  sendInterviewEmail,
  sendInterviewEmailDetailed,
  sendOtpEmail
 };
