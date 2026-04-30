import dotenv from 'dotenv';
dotenv.config();
import { sendBrevoEmailDetailed } from './services/email.js';

async function test() {
  console.log("Testing Brevo with:");
  console.log("API Key:", process.env.BREVO_API_KEY ? "EXISTS (starts with " + process.env.BREVO_API_KEY.slice(0, 8) + ")" : "MISSING");
  console.log("Sender Email:", process.env.BREVO_SENDER_EMAIL || "career.arahinfotech@gmail.com (default)");

  const result = await sendBrevoEmailDetailed({
    toEmail: "chandunetha275@gmail.com",
    toName: "Test User",
    subject: "Brevo Test with Attachment",
    htmlContent: "<h1>Brevo Attachment Test</h1><p>Check if the PDF is attached.</p>",
    attachment: [{
      content: "VGhpcyBpcyBhIHRlc3Q=", // "This is a test" in base64
      name: "test.txt"
    }]
  });

  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

test();
