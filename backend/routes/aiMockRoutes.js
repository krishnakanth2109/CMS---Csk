import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { 
  analyzeAnswer,
  analyzeResumeOrJd,
  extractInfoFromResume,
  generateFollowupQuestion,
  generateInterviewSummary,
  generateMockQuestions,
  sendChatMessage,
  transcribeAudio
} from '../services/ai.js';
import { extractTextFromFile } from '../services/documents.js';
import { 
  isValidEmail, 
  normalizeDecisionStatus, 
  sendDecisionEmailDetailed, 
  sendInterviewEmailDetailed, 
  sendOtpEmail 
} from '../services/email.js';
import { generateInterviewReport } from '../services/report.js';
import { protect } from '../middleware/authMiddleware.js';

dotenv.config();

const router = Router();

const parseRecordVideoFlag = (value) => value === true || value === 'true';

function getCollections() {
  const db = mongoose.connection.db;
  if (!db) {
    console.error("Critical: Database connection not established yet!");
    throw new Error("Database not connected");
  }
  return {
    candidates: db.collection('candidates'),
    interviews: db.collection('interviews'),
    answers: db.collection('answers'),
    admins: db.collection('admins'),
    interviewSessions: db.collection('interview_sessions')
  };
}

const upload = multer({ storage: multer.memoryStorage() });
const interviews = new Map();

const ROOT_DIR = path.resolve(__dirname, "..");
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const RECORDINGS_DIR = path.join(UPLOAD_DIR, "recordings");

if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function createInterviewId() {
  return `int_${Math.floor(Date.now() / 1000)}_${uuidv4().replace(/-/g, "").slice(0, 8)}`;
}

function ensureString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseQuestions(rawQuestions) {
  if (Array.isArray(rawQuestions)) return rawQuestions;
  if (!rawQuestions) return [];
  try {
    return JSON.parse(rawQuestions);
  } catch (error) {
    return [];
  }
}

async function ensureDefaultAdmin() {
  const { admins } = getCollections();
  const existing = await admins.findOne({ username: "admin" });

  if (!existing) {
    await admins.insertOne({
      username: "admin",
      password: hashPassword("admin123"),
      email: process.env.BREVO_SENDER_EMAIL || "",
      created_at: nowIso()
    });
    return;
  }

  if (!existing.email && process.env.BREVO_SENDER_EMAIL) {
    await admins.updateOne({ _id: existing._id }, { $set: { email: process.env.BREVO_SENDER_EMAIL } });
  }
}

async function restoreInterview(interviewId) {
  if (interviews.has(interviewId)) {
    return interviews.get(interviewId);
  }

  const { interviews: interviewsCollection } = getCollections();
  const stored = await interviewsCollection.findOne({ id: interviewId });
  if (!stored) return null;

  const interview = {
    id: stored.id,
    source: stored.source,
    profile_text: stored.profile_text,
    profile_analysis: stored.profile_analysis || null,
    questions: parseQuestions(stored.questions),
    answers: {},
    created_at: stored.created_at,
    candidate_name: stored.candidate_name,
    candidate_email: stored.candidate_email,
    status: stored.status
  };

  interviews.set(interviewId, interview);
  return interview;
}

async function buildInterview({
  content,
  source,
  candidateName = null,
  candidateEmail = null,
  numQuestions = 6,
  resumeText = null,
  jdText = null,
  status = null
}) {
  const interviewId = createInterviewId();
  const profileAnalysis = await analyzeResumeOrJd(content);
  const questions = await generateMockQuestions(content, source, numQuestions, resumeText, jdText);

  const interview = {
    id: interviewId,
    source,
    profile_text: content.slice(0, 5000),
    profile_analysis: profileAnalysis,
    questions,
    answers: {},
    created_at: nowIso(),
    candidate_name: candidateName,
    candidate_email: candidateEmail,
    status
  };

  interviews.set(interviewId, interview);
  return interview;
}

async function persistInterview(interview) {
  const { interviews: interviewsCollection } = getCollections();
  await interviewsCollection.updateOne(
    { id: interview.id },
    {
      $set: {
        id: interview.id,
        interviewId: interview.id,
        source: interview.source,
        profile_text: interview.profile_text,
        profile_analysis: interview.profile_analysis,
        questions: JSON.stringify(interview.questions),
        candidate_name: interview.candidate_name || null,
        candidate_email: interview.candidate_email || null,
        status: interview.status || null,
        created_at: interview.created_at
      }
    },
    { upsert: true }
  );
}

router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: nowIso() });
});

router.post("/generate-next-question", async (req, res) => {
  const { interview_id: interviewId, current_question_id: currentQuestionId, answer_text: answerText } = req.body;
  const interview = await restoreInterview(interviewId);

  if (!interview) {
    res.status(404).json({ detail: "Interview not found" });
    return;
  }

  const MAX_AI_QUESTIONS = 100;
  const currentCount = interview.questions.length;

  try {
    let nextQuestion;
    if (currentCount >= MAX_AI_QUESTIONS) {
      const fallbackQuestions = [
        { question: "Can you tell me more about yourself and your background?", type: "Self Intro", difficulty: "Easy", category: "General" },
        { question: "What are your greatest professional strengths and weaknesses?", type: "HR", difficulty: "Medium", category: "Behavioral" },
        { question: "Can you describe a significant project you worked on recently?", type: "Project", difficulty: "Hard", category: "Technical" },
        { question: "Where do you see yourself in the next five years?", type: "HR", difficulty: "Medium", category: "Career Goals" }
      ];
      const index = (currentCount - MAX_AI_QUESTIONS) % fallbackQuestions.length;
      const base = fallbackQuestions[index];
      nextQuestion = { ...base, id: Number(currentQuestionId) + 1 };
    } else {
      try {
        nextQuestion = await generateFollowupQuestion(answerText, ensureString(interview.profile_text), Number(currentQuestionId));
      } catch (err) {
        nextQuestion = {
          id: Number(currentQuestionId) + 1,
          question: "Could you elaborate on your experience with this topic in a real-world scenario?",
          type: "Recovery",
          difficulty: "Medium",
          category: "Experience"
        };
      }
    }

    const currentIndex = interview.questions.findIndex((question) => Number(question.id) === Number(currentQuestionId));
    if (currentIndex === -1) {
      res.status(400).json({ detail: "Current question ID not found" });
      return;
    }

    const shifted = interview.questions.map((question, index) =>
      index > currentIndex ? { ...question, id: Number(question.id) + 1 } : question
    );
    shifted.splice(currentIndex + 1, 0, nextQuestion);
    interview.questions = shifted;

    await persistInterview(interview);
    res.json(nextQuestion);
  } catch (error) {
    res.status(500).json({ detail: "Failed to process question." });
  }
});

router.post("/upload-resume", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ detail: "File is required" });
    return;
  }
  try {
    const source = req.body.source || "resume";
    const content = await extractTextFromFile(req.file.buffer, req.file.originalname);
    if (!content.trim()) {
      res.status(400).json({ detail: "No readable text found in the file" });
      return;
    }
    const interview = await buildInterview({ content, source });
    await persistInterview(interview);
    res.json({
      interview_id: interview.id,
      total_questions: interview.questions.length,
      first_question: interview.questions[0]
    });
  } catch (error) {
    res.status(500).json({ detail: `Failed to process resume: ${error.message}` });
  }
});

router.post("/start-interview", upload.none(), async (req, res) => {
  try {
    const source = req.body.source || "resume";
    const content = ensureString(req.body.content);
    const interview = await buildInterview({ content, source });
    await persistInterview(interview);
    res.json({
      interview_id: interview.id,
      total_questions: interview.questions.length,
      first_question: interview.questions[0]
    });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

router.get("/interview/:interviewId/question/:questionId", async (req, res) => {
  const interview = await restoreInterview(req.params.interviewId);
  if (!interview) {
    res.status(404).json({ detail: "Interview not found" });
    return;
  }
  const question = interview.questions.find((entry) => Number(entry.id) === Number(req.params.questionId));
  if (!question) {
    res.status(404).json({ detail: "Question not found" });
    return;
  }
  res.json({
    current_question: question,
    total_questions: interview.questions.length,
    interview_id: interview.id
  });
});

router.get("/interview/:interviewId/summary", async (req, res) => {
  const interview = await restoreInterview(req.params.interviewId);
  if (!interview) {
    res.status(404).json({ detail: "Interview not found" });
    return;
  }
  res.json({
    interview_id: interview.id,
    source: interview.source,
    created_at: interview.created_at,
    total_questions: interview.questions.length,
    questions_answered: Object.keys(interview.answers || {}).length,
    questions: interview.questions,
    answers: interview.answers || {}
  });
});

router.post("/chat", async (req, res) => {
  const reply = await sendChatMessage(req.body.message || "");
  res.json({ reply });
});

router.post("/save-answer", upload.none(), async (req, res) => {
  const {
    interview_id: interviewId,
    question_id: questionId,
    question_text: questionText,
    answer_text: answerText
  } = req.body;

  const { answers, interviews: interviewsCollection } = getCollections();
  const interview = interviews.get(interviewId) || (await restoreInterview(interviewId));
  let context = "";

  if (interview) {
    context = `Candidate's ${interview.source}: ${interview.profile_text}`;
  } else {
    const stored = await interviewsCollection.findOne({ id: interviewId });
    if (stored) {
      context = `Candidate's ${stored.source}: ${stored.profile_text}`;
    }
  }

  const aiResult = await analyzeAnswer(questionText, answerText, context);
  const keywords = Array.isArray(aiResult.keywords) ? aiResult.keywords.join(",") : String(aiResult.keywords || "");

  await answers.deleteMany({ interview_id: interviewId, question_id: Number(questionId) });
  await answers.insertOne({
    interview_id: interviewId,
    question_id: Number(questionId),
    question_text: questionText,
    answer_text: answerText,
    ai_score: aiResult.overall_score || 0,
    ai_feedback: aiResult.feedback || "No feedback",
    ai_keywords: keywords,
    corrected_answer: aiResult.corrected_answer || "N/A",
    created_at: nowIso()
  });

  res.json({
    status: "saved",
    ai_score: aiResult.overall_score || 0,
    ai_feedback: aiResult.feedback || ""
  });
});

router.post("/save-behavioral-data", async (req, res) => {
  const { answers } = getCollections();
  await answers.updateMany(
    {
      interview_id: req.body.interview_id,
      question_id: Number(req.body.question_id)
    },
    {
      $set: {
        wpm: Number(req.body.wpm || 0),
        pause_count: Number(req.body.pause_count || 0),
        filler_count: Number(req.body.filler_count || 0),
        time_spent_seconds: Number(req.body.time_spent_seconds || 0),
        keyword_match_pct: Number(req.body.keyword_match_pct || 0),
        tab_switches: Number(req.body.tab_switches || 0),
        face_alerts: Number(req.body.face_alerts || 0)
      }
    }
  );
  res.json({ status: "ok" });
});

router.get("/interview/:interviewId/ai-summary", async (req, res) => {
  const { answers } = getCollections();
  const rows = await answers.find({ interview_id: req.params.interviewId, ai_score: { $ne: null } }).toArray();
  const scores = rows.map((row) => Number(row.ai_score || 0));
  const average = scores.length > 0 ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : 0;
  res.json({
    interview_id: req.params.interviewId,
    average_score: average,
    total_questions: scores.length
  });
});

router.get("/admin/interview/:linkId", protect, async (req, res) => {
  const { answers, interviewSessions, interviews: interviewsCollection } = getCollections();
  const session = await interviewSessions.findOne({ link_id: req.params.linkId, tenantOwnerId: req.tenantId });
  if (!session) {
    res.status(404).json({ detail: "Session not found" });
    return;
  }

  if (session.status === "started" && session.interview_id) {
    const hasAnswers = await answers.findOne({ interview_id: session.interview_id });
    if (hasAnswers) {
      await interviewSessions.updateOne({ link_id: req.params.linkId }, { $set: { status: "completed" } });
      session.status = "completed";
    }
  }

  let recordingUrl = null;
  if (session.interview_id) {
    const interviewRecord = await interviewsCollection.findOne({ id: session.interview_id });
    if (interviewRecord?.recording_path) {
      const normalized = String(interviewRecord.recording_path).replace(/\\/g, "/");
      const index = normalized.indexOf("uploads/");
      if (index !== -1) {
        recordingUrl = "/" + normalized.slice(index);
      }
    }
  }

  const rows = session.interview_id
    ? await answers.find({ interview_id: session.interview_id }).sort({ question_id: 1 }).toArray()
    : [];

  let totalTabSwitches = 0;
  let totalFaceAlerts = 0;
  let totalTime = 0;

  const results = rows.map((row) => {
    totalTabSwitches += Number(row.tab_switches || 0);
    totalFaceAlerts += Number(row.face_alerts || 0);
    totalTime += Number(row.time_spent_seconds || 0);
    return {
      question_id: row.question_id,
      question_text: row.question_text,
      answer_text: row.answer_text || "(No answer yet)",
      ai_score: row.ai_score,
      ai_feedback: row.ai_feedback || "No feedback provided",
      corrected_answer: row.corrected_answer || "N/A",
      wpm: Number(Number(row.wpm || 0).toFixed(1)),
      pause_count: Number(row.pause_count || 0),
      filler_count: Number(row.filler_count || 0),
      time_spent_seconds: Number(row.time_spent_seconds || 0),
      keyword_match_pct: Number(Number(row.keyword_match_pct || 0).toFixed(1)),
      tab_switches: Number(row.tab_switches || 0),
      face_alerts: Number(row.face_alerts || 0)
    };
  });

  const scores = results.map((entry) => entry.ai_score).filter((entry) => entry !== null && entry !== undefined);
  const averageScore = scores.length > 0 ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) : 0;

  res.json({
    interview_id: req.params.linkId,
    actual_interview_id: session.interview_id || null,
    candidate_name: session.candidate_name || "Candidate",
    date: session.created_at,
    source: "Job Description / Resume",
    avg_score: averageScore,
    overall_recommendation: session.overall_recommendation || "Pending",
    strengths_summary: session.strengths_summary || "",
    weaknesses_summary: session.weaknesses_summary || "",
    recording_url: recordingUrl,
    decision: session.decision,
    decision_by: session.decision_by,
    integrity: {
      total_tab_switches: totalTabSwitches,
      total_face_alerts: totalFaceAlerts,
      total_time_minutes: Number((totalTime / 60).toFixed(1))
    },
    record_video: parseRecordVideoFlag(session.record_video),
    answers: results
  });
});

router.post("/analyze-answer", async (req, res) => {
  const { answers } = getCollections();
  const interview = req.body.interview_id ? await restoreInterview(req.body.interview_id) : null;
  const context = interview ? `Candidate's ${interview.source}: ${interview.profile_text}` : "";
  const result = await analyzeAnswer(req.body.question, req.body.answer, context);
  if (req.body.interview_id && req.body.question_id !== undefined) {
    await answers.deleteMany({ interview_id: req.body.interview_id, question_id: Number(req.body.question_id) });
    await answers.insertOne({
      interview_id: req.body.interview_id,
      question_id: Number(req.body.question_id),
      question_text: req.body.question,
      answer_text: req.body.answer,
      ai_score: result.overall_score || 0,
      ai_feedback: result.feedback || "",
      ai_keywords: JSON.stringify(result.keywords || []),
      corrected_answer: result.corrected_answer || "",
      created_at: nowIso()
    });
  }
  res.json(result);
});

router.post("/upload-full-recording", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ detail: "File is required" });
    return;
  }
  const interviewId = req.body.interview_id;
  const { interviewSessions, interviews: interviewsCollection } = getCollections();
  const session = await interviewSessions.findOne({ interview_id: interviewId });
  if (!session || !parseRecordVideoFlag(session.record_video)) {
    res.status(403).json({ detail: "Video recording is disabled for this interview session" });
    return;
  }
  const filePath = path.join(RECORDINGS_DIR, `${interviewId}_full_recording.webm`);
  await fs.promises.writeFile(filePath, req.file.buffer);
  const normalized = filePath.replace(/\\/g, "/");
  await interviewsCollection.updateOne({ id: interviewId }, { $set: { recording_path: normalized } });
  res.json({ status: "success", file_path: normalized });
});

router.get("/generate-report/:interviewId", async (req, res) => {
  const { answers, interviews: interviewsCollection } = getCollections();
  const interview = await interviewsCollection.findOne({ id: req.params.interviewId });
  if (!interview) {
    res.status(404).json({ detail: "Interview not found" });
    return;
  }
  const answerRows = await answers.find({ interview_id: req.params.interviewId }).sort({ question_id: 1 }).toArray();
  const filePath = await generateInterviewReport({
    interviewId: req.params.interviewId,
    source: interview.source,
    date: interview.created_at,
    answers: answerRows,
    outputDir: UPLOAD_DIR,
    decision: interview.decision
  });
  res.sendFile(filePath);
});

router.post("/admin/forgot-password", async (req, res) => {
  const { admins } = getCollections();
  const user = await admins.findOne({ username: req.body.username, email: req.body.email });
  if (!user) {
    res.status(404).json({ detail: "Username and email do not match our records." });
    return;
  }
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await admins.updateOne({ _id: user._id }, { $set: { otp, otp_expiry: expiry } });
  const sent = await sendOtpEmail({ email: req.body.email, name: req.body.username, otp });
  if (!sent) {
    res.status(500).json({ detail: "Failed to send OTP. Please try again later." });
    return;
  }
  res.json({ status: "success", message: "OTP sent to your registered email." });
});

router.post("/admin/verify-otp", async (req, res) => {
  const { admins } = getCollections();
  const user = await admins.findOne({ username: req.body.username });
  if (!user?.otp) {
    res.status(400).json({ detail: "No OTP found for this user." });
    return;
  }
  if (user.otp !== req.body.otp) {
    res.status(401).json({ detail: "Invalid OTP code." });
    return;
  }
  if (new Date() > new Date(user.otp_expiry)) {
    res.status(401).json({ detail: "OTP has expired." });
    return;
  }
  res.json({ status: "success", message: "OTP verified successfully." });
});

router.post("/admin/reset-password", async (req, res) => {
  const { admins } = getCollections();
  const user = await admins.findOne({ username: req.body.username });
  if (!user || user.otp !== req.body.otp) {
    res.status(401).json({ detail: "Invalid session. Please restart the process." });
    return;
  }
  if (new Date() > new Date(user.otp_expiry)) {
    res.status(401).json({ detail: "Session expired." });
    return;
  }
  await admins.updateOne(
    { _id: user._id },
    { $set: { password: hashPassword(req.body.new_password), otp: null, otp_expiry: null } }
  );
  res.json({ status: "success", message: "Password updated successfully. You can now login." });
});

router.post("/admin/login", async (req, res) => {
  const { admins } = getCollections();
  const user = await admins.findOne({ username: req.body.username, password: hashPassword(req.body.password) });
  if (!user) {
    res.status(401).json({ detail: "Invalid credentials" });
    return;
  }
  res.json({
    status: "success",
    admin_id: String(user._id),
    username: user.username,
    email: user.email || ""
  });
});

router.post("/admin/profile", async (req, res) => {
  const { admins } = getCollections();
  await admins.updateOne({ _id: new mongoose.Types.ObjectId(String(req.body.admin_id)) }, { $set: { email: req.body.email } });
  res.json({ status: "success", message: "Profile updated successfully." });
});

router.post("/admin/parse-resume", protect, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ detail: "File is required" });
    return;
  }
  const text = await extractTextFromFile(req.file.buffer, req.file.originalname);
  const info = await extractInfoFromResume(text);
  res.json({ status: "success", text, name: info.name, email: info.email });
});

router.post("/admin/create-session", protect, async (req, res) => {
  const { interviewSessions } = getCollections();
  const linkId = uuidv4();
  const candidateEmail = String(req.body.candidate_email || '').trim().toLowerCase();
  const candidateName = String(req.body.candidate_name || '').trim();

  if (!candidateName || !candidateEmail) {
    return res.status(400).json({ status: "error", detail: "Candidate name and email are required" });
  }
  if (!isValidEmail(candidateEmail)) {
    return res.status(400).json({ status: "error", detail: `Invalid candidate email: ${candidateEmail}` });
  }
  
  const deadlineDate = req.body.deadline_date;
  const expiresAt = deadlineDate
    ? new Date(deadlineDate + 'T23:59:59').toISOString()
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  await interviewSessions.insertOne({
    link_id: linkId,
    candidate_name: candidateName,
    candidate_email: candidateEmail,
    resume_text: req.body.resume_text,
    job_description: req.body.job_description,
    created_by: req.body.admin_id,
    created_by_name: req.body.admin_name || 'Admin',
    created_at: nowIso(),
    expires_at: expiresAt,
    scheduled_time: req.body.scheduled_time || null,
    interview_duration: Number(req.body.interview_duration || 30),
    record_video: req.body.record_video === true || req.body.record_video === 'true',
    status: "pending",
    email_status: "pending",
    tenantOwnerId: req.tenantId
  });

  const linkUrl = `/invite?session_id=${linkId}`;
  const emailResult = await sendInterviewEmailDetailed({
    candidateEmail,
    candidateName,
    linkUrl,
    duration: Number(req.body.interview_duration || 30),
    jobDescription: req.body.job_description || "",
    resumeText: req.body.resume_text || "",
    customBody: req.body.customBody || ""
  }).catch(err => {
    return { ok: false, message: err.message || "Email dispatch crashed" };
  });

  const emailSent = emailResult.ok === true;
  await interviewSessions.updateOne(
    { link_id: linkId, tenantOwnerId: req.tenantId },
    { $set: { email_status: emailSent ? "sent" : "failed", email_sent_at: emailSent ? nowIso() : null, email_error: emailSent ? null : emailResult.message } }
  );

  if (!emailSent) {
    return res.status(502).json({
      status: "error",
      detail: `Interview session was created, but email could not be sent. Reason: ${emailResult.message}`,
      email_reason: emailResult.message
    });
  }

  res.json({ status: "success", link_id: linkId, link_url: linkUrl, email_sent: true });
});

router.post("/admin/bulk-create-sessions", protect, async (req, res) => {
  const { interviewSessions } = getCollections();
  const candidates = req.body.candidates || [];
  const adminId = req.body.admin_id;
  const adminName = req.body.admin_name || 'Admin';
  const duration = Number(req.body.interview_duration || 30);
  const recordVideo = parseRecordVideoFlag(req.body.record_video);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ status: "error", detail: "At least one candidate is required" });
  }

  const deadlineDate = req.body.deadline_date;
  const expiresAt = deadlineDate
    ? new Date(deadlineDate + 'T23:59:59').toISOString()
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const results = [];
  for (const cand of candidates) {
    const linkId = uuidv4();
    const candidateEmail = String(cand.email || '').trim().toLowerCase();
    const candidateName = String(cand.name || '').trim();
    if (!candidateName || !candidateEmail) {
      results.push({ email: candidateEmail, status: 'failed', message: 'Missing name/email' });
      continue;
    }
    const session = {
      link_id: linkId,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      resume_text: cand.resume_text || req.body.global_resume_text || "",
      job_description: cand.job_description || req.body.global_job_description || "",
      created_by: adminId,
      created_by_name: adminName,
      created_at: nowIso(),
      expires_at: expiresAt,
      scheduled_time: req.body.scheduled_time || null,
      interview_duration: duration,
      record_video: recordVideo,
      status: "pending",
      email_status: "pending",
      tenantOwnerId: req.tenantId
    };
    await interviewSessions.insertOne(session);
    const linkUrl = `/invite?session_id=${linkId}`;
    const emailResult = await sendInterviewEmailDetailed({
      candidateEmail,
      candidateName,
      linkUrl,
      duration,
      jobDescription: session.job_description,
      resumeText: session.resume_text,
      skipPdf: true,
      customBody: req.body.customBody || ""
    }).catch(err => ({ ok: false, message: err.message }));
    const emailSent = emailResult.ok === true;
    await interviewSessions.updateOne(
      { link_id: linkId, tenantOwnerId: req.tenantId },
      { $set: { email_status: emailSent ? "sent" : "failed", email_sent_at: emailSent ? nowIso() : null, email_error: emailSent ? null : emailResult.message } }
    );
    results.push({ email: candidateEmail, status: emailSent ? 'success' : 'failed' });
  }
  const failed = results.filter(r => r.status === 'failed');
  res.json({ status: failed.length ? "partial" : "success", processed: candidates.length, sent: results.length - failed.length, failed: failed.length });
});

router.get("/session/:linkId", async (req, res) => {
  const { interviewSessions } = getCollections();
  const session = await interviewSessions.findOne({ link_id: req.params.linkId });
  if (!session) return res.status(404).json({ detail: "Session not found" });
  res.json({
    status: "success",
    candidate_name: session.candidate_name,
    resume_text: session.resume_text,
    job_description: session.job_description,
    session_status: session.status,
    interview_duration: session.interview_duration || 30,
    record_video: parseRecordVideoFlag(session.record_video),
    is_expired: (session.expires_at && new Date() > new Date(session.expires_at)) || ["started", "completed"].includes(session.status)
  });
});

router.get("/admin/sessions", protect, async (req, res) => {
  const { interviewSessions } = getCollections();
  const query = req.query.admin_id === 'all' ? {} : { created_by: req.query.admin_id };
  query.tenantOwnerId = req.tenantId;
  if (req.query.start_date || req.query.end_date) {
    query.created_at = {};
    if (req.query.start_date) query.created_at.$gte = String(req.query.start_date);
    if (req.query.end_date) query.created_at.$lte = `${req.query.end_date}T23:59:59`;
  }
  let sessions = await interviewSessions.find(query).sort({ created_at: -1 }).limit(500).toArray();
  res.json({
    status: "success",
    sessions: sessions.map((session) => ({
      link_id: session.link_id,
      candidate_name: session.candidate_name,
      status: session.status,
      created_at: session.created_at,
      interview_duration: session.interview_duration,
      interview_id: session.interview_id,
      avg_score: session.avg_score,
      recommendation: session.overall_recommendation,
      decision: session.decision,
      decision_by: session.decision_by,
      created_by: session.created_by,
      created_by_name: session.created_by_name,
      record_video: parseRecordVideoFlag(session.record_video),
      isActive: session.isActive !== false
    }))
  });
});

router.post("/start-session-interview", upload.none(), async (req, res) => {
  const { interviewSessions } = getCollections();
  const session = await interviewSessions.findOne({ link_id: req.body.link_id });
  if (!session) return res.status(404).json({ detail: "Session not found" });
  if (session.expires_at && new Date() > new Date(session.expires_at)) {
    return res.json({ is_expired: true, message: "Link expired." });
  }
  if (session.status === "completed" && session.interview_id) {
    return res.json({ already_completed: true, candidate_name: session.candidate_name, interview_id: session.interview_id });
  }
  if (session.status === "started" && session.interview_id) {
    const interview = await restoreInterview(session.interview_id);
    if (interview) {
      return res.json({ interview_id: interview.id, total_questions: interview.questions.length, first_question: interview.questions[0], candidate_name: session.candidate_name });
    }
  }
  const source = session.job_description && session.job_description.length > 50 ? "job_description" : "resume";
  const content = source === "job_description" ? session.job_description : session.resume_text;
  const numQuestions = Math.max(4, Math.min(20, Math.floor((session.interview_duration || 30) / 2)));
  const interview = await buildInterview({ content, source, candidateName: session.candidate_name, candidateEmail: session.candidate_email, numQuestions, resumeText: session.resume_text, jdText: session.job_description, status: "started" });
  await persistInterview(interview);
  await interviewSessions.updateOne({ link_id: req.body.link_id }, { $set: { status: "started", interview_id: interview.id } });
  res.json({ interview_id: interview.id, total_questions: interview.questions.length, first_question: interview.questions[0], candidate_name: session.candidate_name, interview_duration: session.interview_duration || 30, record_video: parseRecordVideoFlag(session.record_video) });
});

router.post("/complete-session/:linkId", async (req, res) => {
  const { interviewSessions } = getCollections();
  await interviewSessions.updateOne({ link_id: req.params.linkId }, { $set: { status: "completed" } });
  triggerAISummary(req.params.linkId);
  res.json({ status: "success" });
});

async function updateDecisionHandler(req, res) {
  const { interviewSessions } = getCollections();
  const normalizedDecision = normalizeDecisionStatus(req.body.decision);
  if (!["selected", "rejected"].includes(normalizedDecision)) return res.status(400).json({ detail: "Invalid decision." });
  const session = await interviewSessions.findOne({ link_id: req.body.link_id, tenantOwnerId: req.tenantId });
  if (!session) return res.status(404).json({ detail: "Session not found" });
  if (session.decision && session.decision !== "pending") return res.status(403).json({ detail: "Decision locked." });
  await interviewSessions.updateOne({ link_id: req.body.link_id, tenantOwnerId: req.tenantId }, { $set: { decision: normalizedDecision, decision_by: req.body.admin_id } });
  const decisionEmail = String(session.candidate_email || "").trim().toLowerCase();
  let emailSent = false;
  if (decisionEmail && isValidEmail(decisionEmail)) {
    const result = await sendDecisionEmailDetailed({ email: decisionEmail, name: session.candidate_name, decision: normalizedDecision, overallRecommendation: session.overall_recommendation, avgScore: session.avg_score, strengths: session.strengths_summary, weaknesses: session.weaknesses_summary }).catch(() => ({ ok: false }));
    emailSent = result.ok === true;
  }
  res.json({ status: "success", decision: normalizedDecision, email_sent: emailSent });
}

router.post("/admin/update-decision", protect, updateDecisionHandler);

router.delete("/admin/delete-session/:linkId", protect, async (req, res) => {
  const { interviewSessions, interviews: interviewsColl, answers } = getCollections();
  const session = await interviewSessions.findOne({ link_id: req.params.linkId, tenantOwnerId: req.tenantId });
  if (!session) return res.status(404).json({ detail: "Not found" });
  await interviewSessions.deleteOne({ link_id: req.params.linkId });
  if (session.interview_id) {
    await interviewsColl.deleteOne({ id: session.interview_id });
    await answers.deleteMany({ interview_id: session.interview_id });
  }
  res.json({ status: "success" });
});

router.post("/admin/delete-sessions", protect, async (req, res) => {
  const { link_ids } = req.body;
  const { interviewSessions, interviews: interviewsColl, answers } = getCollections();
  const sessions = await interviewSessions.find({ link_id: { $in: link_ids }, tenantOwnerId: req.tenantId }).toArray();
  const interviewIds = sessions.map(s => s.interview_id).filter(Boolean);
  await interviewSessions.deleteMany({ link_id: { $in: link_ids } });
  if (interviewIds.length > 0) {
    await interviewsColl.deleteMany({ id: { $in: interviewIds } });
    await answers.deleteMany({ interview_id: { $in: interviewIds } });
  }
  res.json({ status: "success" });
});

async function triggerAISummary(linkId) {
  try {
    const { answers, interviewSessions, interviews } = getCollections();
    const session = await interviewSessions.findOne({ link_id: linkId });
    if (!session || !session.interview_id) return;
    const rows = await answers.find({ interview_id: session.interview_id }).toArray();
    if (rows.length === 0) return;
    const summary = await generateInterviewSummary(session.candidate_name, rows);
    const avg = rows.reduce((a, b) => a + (b.ai_score || 0), 0) / rows.length;
    await interviewSessions.updateOne({ link_id: linkId }, { $set: { overall_recommendation: summary.recommendation, strengths_summary: summary.strengths, weaknesses_summary: summary.weaknesses, avg_score: avg, status: "completed" } });
  } catch (err) {}
}

router.post("/admin/toggle-candidate-status", protect, async (req, res) => {
  const { link_id, isActive } = req.body;
  const { interviewSessions } = getCollections();
  await interviewSessions.updateOne({ link_id, tenantOwnerId: req.tenantId }, { $set: { isActive: isActive === true } });
  res.json({ status: "success", isActive });
});

router.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "No file" });
  const text = await transcribeAudio(req.file.buffer, req.file.originalname);
  res.json({ text });
});

router.post("/save-recording", upload.single("video"), async (req, res) => {
  const { session_id: sessionId } = req.body;
  if (!req.file || !sessionId) return res.status(400).json({ status: "error" });
  const fileName = `recording_${sessionId}_${Date.now()}.webm`;
  const filePath = path.join(ROOT_DIR, "uploads", fileName);
  fs.writeFileSync(filePath, req.file.buffer);
  const recordingUrl = `/uploads/${fileName}`;
  const { interviewSessions } = getCollections();
  await interviewSessions.updateOne({ link_id: sessionId }, { $set: { recording_url: recordingUrl } });
  res.json({ status: "success", recording_url: recordingUrl });
});

setTimeout(() => {
  ensureDefaultAdmin().catch(console.error);
}, 5000);

export default router;
