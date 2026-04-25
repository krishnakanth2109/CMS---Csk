const fs = require('fs');
const file = 'c:/Users/kchan/Downloads/chandu resume/projects/CMS---Csk/backend/forenten/index.html';
let content = fs.readFileSync(file, 'utf8');

const regex = /\s*try \{\s*await fetch\(`\$\{API_BASE_URL\}\/save-behavioral-data`, \{\s*method: "POST",\s*\/\/ Enforce Fullscreen\s*enableFullscreen\(\);\s*\/\/ Reset recording controls\s*document\.getElementById\('startButton'\)\.disabled = false;\s*document\.getElementById\('stopButton'\)\.disabled = true;\s*document\.getElementById\('nextButton'\)\.disabled = true;\s*\/\/ PRE-EMPTIVELY START CAMERA AND MIC \s*\/\/ Ensures browser accepts permissions from direct user click\s*if \(\!window\.mediaStream \|\| \!window\.mediaStream\.active\) \{\s*console\.log\("Preemptively starting webcam on Disclaimer accept\.\.\."\);\s*if \(typeof startFullSessionRecording === 'function'\) \{\s*await startFullSessionRecording\(\);\s*\}\s*\}/s;

const newBlock = `            try {
                await fetch(\`\${API_BASE_URL}/save-behavioral-data\`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            } catch (e) {
                console.error("Behavioral data save failed:", e);
            }
        }
        // ═══════════════════════════════════════════════════════════════════



        async function acceptDisclaimer() {
            // Hide Modal
            document.getElementById('disclaimerModal').classList.add('hidden');

            // Show interview section
            document.getElementById('uploadSection').classList.add('hidden');
            document.getElementById('interviewSection').classList.remove('hidden');

            // Enforce Fullscreen
            enableFullscreen();

            // Reset recording controls
            document.getElementById('startButton').disabled = false;
            document.getElementById('stopButton').disabled = true;
            document.getElementById('nextButton').disabled = true;

            // PRE-EMPTIVELY START CAMERA AND MIC 
            if (window.recordVideo !== false) {
                console.log("Starting full session video recording...");
                if (typeof startFullSessionRecording === 'function') {
                    await startFullSessionRecording();
                }
            } else {
                console.log("Video recording is disabled for this session.");
                if (!window.mediaStream || !window.mediaStream.active) {
                    try {
                        window.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        const videoPreview = document.getElementById('videoPreview');
                        if (videoPreview) {
                            videoPreview.srcObject = window.mediaStream;
                            videoPreview.muted = true;
                            await videoPreview.play();
                            if (typeof startFaceDetection === 'function') startFaceDetection(videoPreview);
                        }
                    } catch (e) {
                         console.error("Camera access failed for non-recorded session:", e);
                    }
                } else {
                    const videoPreview = document.getElementById('videoPreview');
                    if (videoPreview && typeof startFaceDetection === 'function') {
                        startFaceDetection(videoPreview);
                    }
                }
            }`;

if (regex.test(content)) {
    content = content.replace(regex, newBlock);
    fs.writeFileSync(file, content, 'utf8');
    console.log("File patched successfully!");
} else {
    console.error("Regex did not match! The file might already be fixed or manual repair requires another script.");
}
