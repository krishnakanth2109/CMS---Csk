import OpenAI from 'openai';
import {  toFile  } from 'openai/uploads';

const COMMON_SKILLS = [
  "Python", "JavaScript", "Java", "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin", "Go", "Rust", "TypeScript",
  "HTML", "CSS", "React", "Angular", "Vue.js", "Node.js", "Django", "Flask", "Spring", "ASP.NET", "Express.js",
  "SQL", "MySQL", "PostgreSQL", "MongoDB", "Oracle", "SQLite", "Redis", "Cassandra",
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "Git", "CI/CD",
  "Data Science", "Machine Learning", "Deep Learning", "Data Analysis", "Pandas", "NumPy", "TensorFlow", "PyTorch", "scikit-learn",
  "REST API", "GraphQL", "Microservices", "Agile", "Scrum", "TDD", "OOP", "Functional Programming"
];

function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1"
  });
}

function extractJson(text) {
  if (!text) {
    throw new Error("No model response received.");
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("JSON block not found in model response.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

async function chatCompletion({ model, messages }) {
  const client = getOpenRouterClient();
  if (!client) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await client.chat.completions.create({
    model,
    messages
  });

  return response.choices?.[0]?.message?.content || "";
}

function extractSkills(text) {
  const source = (text || "").toLowerCase();
  const matches = COMMON_SKILLS.filter((skill) => source.includes(skill.toLowerCase()));
  return [...new Set(matches)].slice(0, 8);
}

function extractExperiences(text) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const experiences = [];
  const roles = ["developer", "engineer", "analyst", "specialist", "manager", "designer", "researcher", "scientist"];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();
    if (!roles.some((role) => lower.includes(role))) {
      continue;
    }

    const experience = {
      title: line,
      company: lines[index + 1] && lines[index + 1].length < 50 ? lines[index + 1] : "a company"
    };

    if (!experiences.some((entry) => entry.title === experience.title && entry.company === experience.company)) {
      experiences.push(experience);
    }

    if (experiences.length >= 3) {
      break;
    }
  }

  return experiences;
}

function extractProjects(text) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const projects = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();
    if (!(lower.includes("project") || lower.includes("portfolio")) || line.split(/\s+/).length >= 5) {
      continue;
    }

    const project = {
      name: line.replace(/project:/i, "").trim(),
      description: lines[index + 1] && lines[index + 1].length > 10 && lines[index + 1].length < 200 ? lines[index + 1] : ""
    };

    if (!projects.some((entry) => entry.name === project.name)) {
      projects.push(project);
    }
  }

  return projects;
}

function generateResumeQuestions(resumeText) {
  const skills = extractSkills(resumeText);
  const experiences = extractExperiences(resumeText);
  const projects = extractProjects(resumeText);
  const questions = [
    {
      id: 1,
      question: "Can you please introduce yourself and tell us about your professional background?",
      difficulty: "Easy",
      type: "Self-Introduction",
      category: "Basic"
    },
    {
      id: 2,
      question: "What motivated you to pursue a career in this field, and what are your key strengths?",
      difficulty: "Easy",
      type: "Self-Introduction",
      category: "Background"
    }
  ];

  skills.slice(0, 2).forEach((skill) => {
    questions.push({
      id: questions.length + 1,
      question: `How would you rate your proficiency in ${skill} and what projects have you used it in?`,
      difficulty: "Easy",
      type: "Technical",
      category: `${skill} Basics`
    });
  });

  experiences.slice(0, 2).forEach((experience, index) => {
    questions.push({
      id: questions.length + 1,
      question: `At ${experience.company} as a ${experience.title}, what were your key responsibilities and achievements?`,
      difficulty: "Medium",
      type: "Experience",
      category: "Work History"
    });

    if (index === 0) {
      questions.push({
        id: questions.length + 1,
        question: `What was the most challenging project you worked on at ${experience.company} and how did you handle it?`,
        difficulty: "Medium",
        type: "Problem-Solving",
        category: "Work Challenges"
      });
    }
  });

  skills.slice(2, 4).forEach((skill) => {
    questions.push({
      id: questions.length + 1,
      question: `Can you explain a complex problem you solved using ${skill}? What was your approach and what did you learn?`,
      difficulty: "Hard",
      type: "Technical",
      category: `Advanced ${skill}`
    });
  });

  if (questions.length < 8 && projects.length > 0) {
    questions.push({
      id: questions.length + 1,
      question: `Tell me about your project '${projects[0].name}'. What was your role, and what technologies did you use?`,
      difficulty: "Medium",
      type: "Project",
      category: "Projects"
    });
  }

  [
    {
      question: "What technical skills are you currently working to improve, and how are you going about it?",
      difficulty: "Easy",
      type: "Career Development",
      category: "Future Goals"
    },
    {
      question: "Where do you see your career in the next 3-5 years, and how does this position align with your goals?",
      difficulty: "Medium",
      type: "Career Goals",
      category: "Future Planning"
    }
  ].forEach((entry) => {
    questions.push({ id: questions.length + 1, ...entry });
  });

  const genericQuestions = [
    "Can you describe a time when you had to work under pressure to meet a tight deadline?",
    "How do you approach learning new technologies or programming languages?",
    "Can you explain a technical concept to someone who doesn't have a technical background?",
    "What development tools and IDEs are you most comfortable using, and why?",
    "How do you handle code reviews and feedback on your work?",
    "What version control systems have you worked with, and what's your experience with them?",
    "Can you describe your experience with testing and quality assurance processes?",
    "How do you stay updated with the latest industry trends and technologies?",
    "What's your approach to debugging complex issues in your code?",
    "Can you describe a time when you had to collaborate with a difficult team member and how you handled it?"
  ];

  while (questions.length < 10 && genericQuestions.length > 0) {
    questions.push({
      id: questions.length + 1,
      question: genericQuestions.shift(),
      difficulty: "Medium",
      type: "General",
      category: "Professional Development"
    });
  }

  return questions.slice(0, 25);
}

async function analyzeResumeOrJd(text) {
  const prompt = `
Analyze the following resume or job description and return STRICT JSON only:
{
  "skills": [],
  "projects": [],
  "tools_and_technologies": [],
  "experience_level": "",
  "domains": [],
  "important_keywords": []
}
Content: ${text}
`;

  try {
    const raw = await chatCompletion({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }]
    });
    return extractJson(raw);
  } catch (error) {
    return {
      skills: [],
      projects: [],
      tools_and_technologies: [],
      experience_level: "Unknown",
      domains: [],
      important_keywords: []
    };
  }
}

async function generateJdQuestions(jdText) {
  const questions = [
    {
      id: 1,
      question: "Can you please introduce yourself and tell us why you are interested in this specific role?",
      difficulty: "Easy",
      type: "Self-Introduction",
      category: "Basic"
    }
  ];

  const prompt = `
You are an expert technical recruiter constructing a rigorous interview.

Job Description:
${(jdText || "").slice(0, 4000)}

Task:
1. Extract the top 5 critical technical keywords or skills.
2. Generate 6 interview questions that directly test those skills.
3. Return STRICT JSON only with keys "extracted_keywords" and "questions".
`;

  try {
    const raw = await chatCompletion({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    const data = extractJson(raw);

    (data.questions || []).forEach((question) => {
      questions.push({
        id: questions.length + 1,
        question: question.question,
        difficulty: question.difficulty || "Medium",
        type: question.type || "General",
        category: question.category || "JD Requirement"
      });
    });
  } catch (error) {
    const fallbackKeywords = [
      "Python", "Java", "React", "Angular", "Vue", "AWS", "Azure", "Docker", "Kubernetes", "SQL",
      "NoSQL", "Git", "CI/CD", "Machine Learning", "AI", "Data Science", "Spring", "Node.js",
      "JavaScript", "TypeScript", "C++", "C#", ".NET", "Go", "Rust", "Swift", "Kotlin", "Flutter"
    ].filter((keyword) => (jdText || "").toLowerCase().includes(keyword.toLowerCase()));

    if (fallbackKeywords.length > 0) {
      fallbackKeywords.slice(0, 5).forEach((keyword) => {
        questions.push({
          id: questions.length + 1,
          question: `Can you describe your experience with ${keyword} and a challenging problem you solved using it?`,
          difficulty: "Medium",
          type: "Technical",
          category: `${keyword} Skill`
        });
      });
    } else {
      questions.push(
        {
          id: questions.length + 1,
          question: "What specifically attracted you to the technical requirements of this position?",
          difficulty: "Medium",
          type: "General",
          category: "Fit"
        },
        {
          id: questions.length + 1,
          question: "Can you walk us through your most significant technical achievement relevant to this role?",
          difficulty: "Hard",
          type: "Project",
          category: "Experience"
        }
      );
    }
  }

  return questions;
}

function generateOfflineQuestions(text, count) {
  const lower = (text || "").toLowerCase();
  const techKeywords = [
    "Python", "Java", "JavaScript", "TypeScript", "React", "Angular", "Vue", "Node.js",
    "Express", "Django", "Flask", "FastAPI", "Spring Boot", "Spring", ".NET", "C#", "C++",
    "Go", "Rust", "Swift", "Kotlin", "Flutter", "React Native", "PHP", "Ruby", "Rails",
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Jenkins", "CI/CD", "Terraform",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB",
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "NLP", "Computer Vision",
    "REST API", "GraphQL", "Microservices", "System Design", "Data Structures",
    "Algorithms", "HTML", "CSS", "Tailwind", "Bootstrap", "Git", "Linux",
    "Agile", "Scrum", "JIRA", "Figma", "Power BI", "Tableau", "Excel",
    "Selenium", "Jest", "Pytest", "JUnit", "Cypress", "Pandas", "NumPy",
    "Apache Kafka", "RabbitMQ", "WebSocket", "OAuth", "JWT", "Firebase",
    "Salesforce", "SAP", "ServiceNow", "Hadoop", "Spark", "Databricks"
  ];

  const foundSkills = techKeywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
  const projectMatches = Array.from(
    new Set(
      (text || "").match(/(?:project|built|developed|created|designed)\s*[:\-]?\s*([A-Z][A-Za-z0-9\s\-]{3,30})/gim) || []
    )
  ).slice(0, 3);
  const companyMatches = Array.from(
    new Set(
      ((text || "").match(/(?:at|@|company|organization|employer)\s*[:\-]?\s*([A-Z][A-Za-z0-9\s&.,]{2,30})/gm) || []).map(
        (match) => match.replace(/^(?:at|@|company|organization|employer)\s*[:\-]?\s*/i, "").trim()
      )
    )
  ).slice(0, 2);

  const difficultyCycle = ["Easy", "Medium", "Medium", "Hard", "Medium", "Hard", "Medium"];
  const questions = [];
  const skillTemplates = [
    ["How would you rate your proficiency in {skill}? Can you describe a project where you used it?", "Technical", "{skill} Basics"],
    ["Can you explain a complex problem you solved using {skill}? Walk us through your approach.", "Technical", "{skill} Deep Dive"],
    ["How does {skill} compare to alternative technologies you've used? When would you choose it over others?", "Comparison", "{skill} Analysis"],
    ["What best practices do you follow when working with {skill}?", "Technical", "{skill} Best Practices"]
  ];

  foundSkills.forEach((skill, index) => {
    if (questions.length >= count) {
      return;
    }
    const [template, type, category] = skillTemplates[index % skillTemplates.length];
    questions.push({
      question: template.replaceAll("{skill}", skill),
      difficulty: difficultyCycle[index % difficultyCycle.length],
      type,
      category: category.replaceAll("{skill}", skill)
    });
  });

  projectMatches.forEach((project) => {
    if (questions.length < count) {
      questions.push({
        question: `Tell me about your project '${project}'. What was your role, what challenges did you face, and what technologies did you use?`,
        difficulty: "Medium",
        type: "Project",
        category: "Projects"
      });
    }
  });

  companyMatches.forEach((company) => {
    if (questions.length < count) {
      questions.push({
        question: `Can you describe your key responsibilities and achievements while working at ${company}?`,
        difficulty: "Medium",
        type: "Experience",
        category: "Work History"
      });
    }
  });

  [
    {
      question: "Can you walk us through your most significant technical achievement? What made it challenging?",
      difficulty: "Medium",
      type: "Technical",
      category: "Achievement"
    },
    {
      question: "How do you approach debugging a complex issue in production? Walk us through your process.",
      difficulty: "Hard",
      type: "Problem-Solving",
      category: "Debugging"
    },
    {
      question: "Describe a time when you had to learn a new technology quickly for a project. How did you approach it?",
      difficulty: "Medium",
      type: "Behavioral",
      category: "Learning Ability"
    },
    {
      question: "How do you ensure code quality in your projects? What tools and practices do you follow?",
      difficulty: "Medium",
      type: "Technical",
      category: "Best Practices"
    },
    {
      question: "Tell me about a time you disagreed with a technical decision on your team. How did you handle it?",
      difficulty: "Medium",
      type: "Behavioral",
      category: "Teamwork"
    },
    {
      question: "If you had to design a scalable system from scratch for this role, what architecture would you choose and why?",
      difficulty: "Hard",
      type: "System Design",
      category: "Architecture"
    }
  ].forEach((entry) => {
    if (questions.length < count) {
      questions.push(entry);
    }
  });

  return questions.slice(0, count);
}

async function generateMockQuestions(text, source, numQuestions = 6, resumeText = null, jdText = null) {
  const total = Math.max(4, numQuestions);
  const opening = [
    {
      id: 1,
      question: "Can you please introduce yourself and tell us why you are interested in this specific role?",
      difficulty: "Easy",
      type: "Self-Introduction",
      category: "Basic"
    }
  ];
  const closing = [
    {
      question: "What do you consider your biggest strengths and weaknesses?",
      difficulty: "Easy",
      type: "Self-Assessment",
      category: "Strengths & Weaknesses"
    },
    {
      question: "Where do you see yourself in the next 5 years, and how does this role fit into that vision?",
      difficulty: "Easy",
      type: "Career Goals",
      category: "Future Plans"
    }
  ];

  if (total >= 8) {
    closing.push({
      question: "Do you have any questions for us about the team, the role, or the company?",
      difficulty: "Easy",
      type: "Closing",
      category: "Candidate Questions"
    });
  }

  const middleCount = Math.max(1, total - opening.length - closing.length);
  const middleQuestions = [];

  try {
    const generated = source.toLowerCase().includes("resume")
      ? generateResumeQuestions(text)
      : await generateJdQuestions(text);

    generated.forEach((question) => {
      const type = String(question.type || "").toLowerCase();
      const category = String(question.category || "").toLowerCase();
      if (
        !type.includes("self-intro") &&
        !type.includes("introduction") &&
        !type.includes("career") &&
        !type.includes("future") &&
        !category.includes("basic") &&
        !category.includes("background") &&
        !category.includes("future goals") &&
        !category.includes("closing")
      ) {
        middleQuestions.push(question);
      }
    });
  } catch (error) {
    // Fall through to offline mode.
  }

  if (middleQuestions.length < middleCount) {
    middleQuestions.push(...generateOfflineQuestions([resumeText, jdText, text].filter(Boolean).join(" "), middleCount - middleQuestions.length));
  }

  const assembled = [];
  let id = 1;
  [...opening, ...middleQuestions.slice(0, middleCount), ...closing].forEach((question) => {
    assembled.push({ ...question, id });
    id += 1;
  });

  return assembled;
}

async function analyzeAnswer(question, answer, context = "") {
  if (!answer || !answer.trim() || ["Transcribing...", "Your speech will appear here automatically..."].includes(answer.trim())) {
    return {
      corrected_answer: "No answer provided.",
      grammar_score: 0,
      relevance_score: 0,
      clarity_score: 0,
      overall_score: 0,
      feedback: "Please record your answer before analyzing.",
      keywords: []
    };
  }

  const prompt = `
You are an expert technical interviewer and performance analyst. 
Your task is to accurately score the candidate's response on a scale of 0-100 based on the following criteria:
1. Technical Correctness (60%): How accurate is the technical information provided?
2. Relevance (20%): Does the answer directly address the question?
3. Clarity and Professionalism (20%): Is the communication clear and structured?

Context (Job Description/Resume):
${context}

Interview Question: "${question}"
Candidate's Response: "${answer}"

SCORING RULES:
- If the answer is completely wrong or nonsensical, score 0-10.
- If the answer is partially correct but lacks depth, score 40-55.
- If the answer is technically sound but poorly explained, score 60-70.
- If the answer is excellent and technically perfect, score 85-100.
- Heavier penalty for circular reasoning or "fluff" without technical substance.

Return VALID JSON ONLY:
{
  "corrected_answer": "Model Answer: ...",
  "grammar_score": 0,
  "relevance_score": 0,
  "clarity_score": 0,
  "overall_score": 0, 
  "feedback": "Detailed feedback focusing on what was missing or correct...",
  "keywords": ["key1", "key2"]
}
`;

  try {
    const raw = await chatCompletion({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a stringent, expert technical evaluator. You produce objective, data-driven scores for interview responses." },
        { role: "user", content: prompt }
      ]
    });
    const result = extractJson(raw);

    if (answer.trim().split(/\s+/).length < 15 && Number(result.overall_score || 0) > 40) {
      result.overall_score = 10;
      if (!String(result.feedback || "").toLowerCase().includes("too short")) {
        result.feedback = `Your answer was too short to be evaluated properly. Please provide a more detailed response. ${result.feedback || ""}`.trim();
      }
    }

    return result;
  } catch (error) {
    const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
    const score = wordCount < 10 ? 15 : Math.min(Math.max(wordCount * 2, 40), 85);
    return {
      corrected_answer: "Analysis unavailable (Offline Mode)",
      overall_score: score,
      feedback:
        wordCount < 10
          ? `Offline mode: answer too short (${wordCount} words). Please provide more detail.`
          : `Offline mode: your answer was recorded (${wordCount} words). Add API credentials for full AI analysis.`,
      keywords: ["Offline"]
    };
  }
}

async function generateFollowupQuestion(answerText, resumeContext, currentQuestionId) {
  const raw = await chatCompletion({
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `
You are an intelligent technical interviewer.

Context:
- Candidate Resume Summary: ${(resumeContext || "").slice(0, 1000)}
- Candidate's Last Answer: "${answerText}"

Return STRICT JSON:
{
  "question": "The actual question string...",
  "difficulty": "Medium",
  "type": "Follow-up",
  "category": "Deep Dive"
}
`
      }
    ]
  });

  return { ...extractJson(raw), id: Number(currentQuestionId) + 1 };
}

async function generateInterviewSummary(candidateName, answersData) {
  if (!answersData || answersData.length === 0) {
    return {
      recommendation: "No Data",
      strengths: "No answers provided.",
      weaknesses: "No answers provided."
    };
  }

  const average = answersData.reduce((sum, entry) => sum + Number(entry.ai_score || 0), 0) / answersData.length;
  const qaBlock = answersData
    .map((entry, index) => `Q${index + 1}: ${entry.question_text}\nA: ${entry.answer_text}\nScore: ${entry.ai_score || 0}/100`)
    .join("\n\n");

  try {
    const raw = await chatCompletion({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `
You are a senior hiring manager reviewing an interview for ${candidateName}.

${qaBlock}

Average score: ${average.toFixed(1)}/100

Respond in JSON with keys "recommendation", "strengths", and "weaknesses".
`
        }
      ]
    });

    return extractJson(raw);
  } catch (error) {
    let recommendation = "No Hire";
    if (average >= 75) recommendation = "Strong Hire";
    else if (average >= 55) recommendation = "Hire";
    else if (average >= 35) recommendation = "Borderline";

    return {
      recommendation,
      strengths: "Summary generation failed. Please review the per-question scores.",
      weaknesses: "Summary generation failed. Please review the per-question scores."
    };
  }
}

async function extractInfoFromResume(text) {
  try {
    const raw = await chatCompletion({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "system",
          content: "You are a professional recruiting assistant that returns JSON only."
        },
        {
          role: "user",
          content: `Extract the candidate's full name and email address from the resume text below. Return ONLY valid JSON with keys "name" and "email". Use null if missing.\n\n${(text || "").slice(0, 5000)}`
        }
      ]
    });

    return extractJson(raw);
  } catch (error) {
    const emailMatch = (text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const firstLine = (text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    return {
      name: firstLine || null,
      email: emailMatch ? emailMatch[0] : null
    };
  }
}

async function sendChatMessage(message) {
  try {
    const raw = await chatCompletion({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful interview assistant. Keep responses short."
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    return raw || "I couldn't generate a reply right now.";
  } catch (error) {
    return "Chat is unavailable right now. Please try again later.";
  }
}

async function transcribeAudio(buffer, filename = "answer.webm") {
  if (!process.env.OPENAI_API_KEY) {
    return "";
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = await toFile(buffer, filename);
    const result = await client.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe"
    });
    return result.text || "";
  } catch (error) {
    return "";
  }
}

export { 
  analyzeAnswer,
  analyzeResumeOrJd,
  extractInfoFromResume,
  generateFollowupQuestion,
  generateInterviewSummary,
  generateMockQuestions,
  sendChatMessage,
  transcribeAudio
 };
