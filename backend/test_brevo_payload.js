import dotenv from 'dotenv';
dotenv.config();
import { sendInterviewEmailDetailed } from './services/email.js';

async function test() {
  const options = {
    candidateEmail: "chandunetha275@gmail.com",
    candidateName: "Chandu",
    linkUrl: "/invite?session_id=test-uuid",
    duration: 30,
    jobDescription: "Python Developer position",
    resumeText: "Experience with React and Node.js",
    skipPdf: false
  };

  console.log("Dispatching Interview Email...");
  const result = await sendInterviewEmailDetailed(options);

  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

test();
