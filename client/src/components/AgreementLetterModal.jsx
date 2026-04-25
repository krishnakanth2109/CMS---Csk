import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { generatePdfWithTemplate } from '../utils/pdfTemplateGenerator';
import { API_URL } from '../config';
import {
    Sparkles, X, UploadCloud, FileText, Send,
    Download, AlignLeft, AlignCenter, AlignRight, Pencil
} from 'lucide-react';

const COMPANY_NAMES = {
    '/Arah_Template.pdf': 'Arah Infotech Pvt Ltd',
    '/UPlife.pdf': 'UP LIFE INDIA PVT LTD',
    '/Vagerious.pdf': 'VAGARIOUS SOLUTIONS PVT LTD',
    '/Zero7_A4.jpg': 'ZERO7 TECHNOLOGIES TRAINING & DEVELOPMENT'
};

const EditableContent = ({ initialContent, onChange }) => {
    const editorRef = React.useRef(null);

    React.useEffect(() => {
        if (editorRef.current && initialContent && !editorRef.current.innerHTML) {
            editorRef.current.innerHTML = initialContent;
        }
    }, []);

    React.useEffect(() => {
        if (editorRef.current && initialContent !== editorRef.current.innerHTML) {
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = initialContent;
            }
        }
    }, [initialContent]);

    const [activeFormats, setActiveFormats] = React.useState({});

    const checkActiveFormats = () => {
        setActiveFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            justifyLeft: document.queryCommandState('justifyLeft'),
            justifyCenter: document.queryCommandState('justifyCenter'),
            justifyRight: document.queryCommandState('justifyRight'),
        });
    };

    const handleInput = (e) => {
        onChange(e.currentTarget.innerHTML);
        checkActiveFormats();
    };

    const execCmd = (cmd, val = null) => {
        document.execCommand(cmd, false, val);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
        checkActiveFormats();
    };

    const getBtnStyle = (isActive) => ({
        padding: '6px 10px',
        background: isActive ? 'var(--accent-color)' : 'var(--bg-secondary)',
        border: isActive ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
        color: isActive ? 'white' : 'var(--text-primary)',
        borderRadius: '4px',
        cursor: 'pointer',
        minWidth: '32px',
        fontWeight: isActive ? 'bold' : 'normal',
        transition: 'all 0.1s'
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
            {/* TOOLBAR */}
            <div style={{
                display: 'flex', gap: '8px', padding: '8px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', alignItems: 'center', flexWrap: 'wrap'
            }}>
                <button onClick={() => execCmd('bold')} style={getBtnStyle(activeFormats.bold)} title="Bold"><b>B</b></button>
                <button onClick={() => execCmd('italic')} style={getBtnStyle(activeFormats.italic)} title="Italic"><i>I</i></button>
                <button onClick={() => execCmd('underline')} style={getBtnStyle(activeFormats.underline)} title="Underline"><u>U</u></button>

                <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

                <select onChange={(e) => execCmd('fontName', e.target.value)} style={selectStyle} defaultValue="Arial">
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Tahoma">Tahoma</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                </select>

                <select onChange={(e) => execCmd('fontSize', e.target.value)} style={selectStyle} defaultValue="3">
                    <option value="1">Tiny (1)</option>
                    <option value="2">Small (2)</option>
                    <option value="3">Normal (3)</option>
                    <option value="4">Medium (4)</option>
                    <option value="5">Large (5)</option>
                    <option value="6">X-Large (6)</option>
                    <option value="7">Huge (7)</option>
                </select>

                <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

                <button onClick={() => execCmd('justifyLeft')} style={getBtnStyle(activeFormats.justifyLeft)} title="Align Left"><AlignLeft size={16} /></button>
                <button onClick={() => execCmd('justifyCenter')} style={getBtnStyle(activeFormats.justifyCenter)} title="Align Center"><AlignCenter size={16} /></button>
                <button onClick={() => execCmd('justifyRight')} style={getBtnStyle(activeFormats.justifyRight)} title="Align Right"><AlignRight size={16} /></button>
            </div>

            {/* EDITOR */}
            <div
                ref={editorRef}
                className="document-editor"
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyUp={checkActiveFormats}
                onMouseUp={checkActiveFormats}
                style={{
                    flex: 1,
                    padding: '3rem',
                    color: '#1e293b',
                    overflowY: 'auto',
                    outline: 'none',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.02)'
                }}
            />
        </div>
    );
};

const selectStyle = {
    padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', cursor: 'pointer',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)'
};

const AgreementLetterModal = ({ employee, onClose, onSuccess }) => {
    const [letterType, setLetterType] = useState('Agreement');
    const [generatedContent, setGeneratedContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('pdf');

    const [selectedTemplate, setSelectedTemplate] = useState('/Arah_Template.pdf');
    const [companyName, setCompanyName] = useState('Arah Infotech Pvt Ltd');

    const prevTemplateRef = React.useRef(selectedTemplate);
    const prevCompanyNameRef = React.useRef(companyName);
    const contentRef = React.useRef(generatedContent);

    useEffect(() => {
        contentRef.current = generatedContent;
    }, [generatedContent]);

    const [pdfUrl, setPdfUrl] = useState(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const [emailBody, setEmailBody] = useState("");
    const fileInputRef = React.useRef(null);

    const handleCustomTemplateUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/upload/template-pdf`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Upload failed");
            setSelectedTemplate(data.url);

            let parsedName = data.filename.replace(/\.pdf\.jpg$|\.jpg$|\.png$/i, '');
            parsedName = parsedName.replace(/_Offer_Letter_Background|_Offer_Letter|_Agreement|_Template|_Background/gi, '');
            parsedName = parsedName.replace(/_/g, ' ').trim();
            if (parsedName) {
                setCompanyName(parsedName);
            }

            alert(`Custom Template Uploaded! \n${data.filename}`);
        } catch (err) {
            console.error(err);
            alert("Upload failed: " + err.message);
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        if (COMPANY_NAMES[selectedTemplate]) {
            setCompanyName(COMPANY_NAMES[selectedTemplate]);
        }
    }, [selectedTemplate]);

    useEffect(() => {
        const prevName = prevCompanyNameRef.current;
        prevCompanyNameRef.current = companyName;

        setEmailBody(
            `Dear ${employee.name},\n\nWe are pleased to align on an agreement with ${companyName}.\n\nPlease find the detailed agreement document attached.\n\nBest Regards,\nTeam`
        );

        if (generatedContent && prevName !== companyName) {
            let newContent = generatedContent;

            const namesToReplace = new Set();
            if (prevName) namesToReplace.add(prevName);
            Object.values(COMPANY_NAMES).forEach(name => namesToReplace.add(name));

            namesToReplace.forEach(name => {
                if (name.toLowerCase() === companyName.toLowerCase()) return;
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedName, 'gi');
                newContent = newContent.replace(regex, companyName);
            });

            if (newContent !== generatedContent) {
                setGeneratedContent(newContent);
            } else {
                if (viewMode === 'pdf') {
                    generatePreview(generatedContent);
                }
            }
        }
    }, [companyName]);

    useEffect(() => {
        if (!generatedContent || viewMode !== 'pdf') return;
        const timer = setTimeout(() => {
            generatePreview(generatedContent);
        }, 500);
        return () => clearTimeout(timer);
    }, [generatedContent, selectedTemplate]);

    const handleGenerate = () => {
        setLoading(true);
        setPdfUrl(null);
        fetch(`${API_URL}/agreement-letters/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: employee.id,
                letter_type: letterType,
                tone: "Professional",
                company_name: companyName
            })
        })
            .then(res => res.json())
            .then(async data => {
                setGeneratedContent(data.content);
                setLoading(false);
                await generatePreview(data.content);
            })
            .catch(err => {
                console.error("Error generating letter:", err);
                setLoading(false);
                setGeneratedContent("Error: Could not connect to API Service.");
            });
    };

    const generatePreview = async (htmlContent) => {
        setIsGeneratingPdf(true);
        try {
            const contentWithoutHeader = htmlContent.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
            const dataUri = await generatePdfWithTemplate(contentWithoutHeader, selectedTemplate);
            setPdfUrl(dataUri);
        } catch (e) {
            console.error(e);
        }
        setIsGeneratingPdf(false);
        setViewMode('pdf');
    };

    const handleDownloadPDF = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${employee.name.replace(/\s+/g, '_')}_${letterType}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendEmail = async () => {
        const btn = document.getElementById('agreementEmailBtn');
        btn.innerText = 'Sending...';
        btn.disabled = true;

        try {
            const subject = `${letterType} - ${employee.name}`;
            const res = await fetch(`${API_URL}/agreement-email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employee.id,
                    letter_content: generatedContent,
                    pdf_base64: pdfUrl,
                    custom_message: emailBody,
                    subject: subject,
                    company_name: companyName
                })
            });

            const data = await res.json();
            if (data.status === 'error') throw new Error(data.message);

            alert("Email Sent Successfully! 🚀");
            btn.innerText = 'Sent ✅';
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error(err);
            alert("Failed: " + err.message);
            btn.innerText = 'Retry ❌';
            btn.disabled = false;
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 3000
        }}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                    background: 'var(--bg-secondary)',
                    padding: '0.75rem',
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    border: 'none',
                    borderRadius: 0,
                }}
            >
                {/* COMPACT THEMED HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <div>
                        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={18} style={{ color: 'var(--accent-color)' }} /> Document Workshop: {employee.name}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#ef4444',
                            border: 'none',
                            color: 'white',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* THEMED CONTROLS */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '12px' }}>
                    <input
                        type="text"
                        placeholder="Company Name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        style={{
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: '1 1 200px', fontSize: '0.9rem', outline: 'none'
                        }}
                    />

                    <select
                        value={letterType}
                        onChange={(e) => setLetterType(e.target.value)}
                        style={{
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: '1 1 120px', fontSize: '0.9rem', outline: 'none'
                        }}
                    >
                        <option>Agreement</option>
                    </select>

                    <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        style={{
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: '1 1 150px', fontSize: '0.9rem', outline: 'none'
                        }}
                    >
                        <option value="/Arah_Template.pdf">Arah Infotech</option>
                        <option value="/UPlife.pdf">UPlife</option>
                        <option value="/Vagerious.pdf">Vagarious</option>
                        <option value="/Zero7_A4.jpg">Zero7</option>
                        {![ '/Arah_Template.pdf', '/UPlife.pdf', '/Vagerious.pdf', '/Zero7_A4.jpg'].includes(selectedTemplate) && (
                            <option value={selectedTemplate}>Custom Template</option>
                        )}
                    </select>

                    <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCustomTemplateUpload} />
                    <button
                        onClick={() => fileInputRef.current.click()}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)',
                            color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', justifyContent: 'center'
                        }}
                    >
                        <UploadCloud size={16} /> <span className="hide-mobile">Custom</span> Template
                    </button>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        style={{
                            background: loading ? 'var(--border-color)' : 'var(--accent-color)',
                            color: 'white', border: 'none', padding: '10px 24px',
                            borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                            flex: '1 1 200px', fontSize: '0.95rem', boxShadow: 'var(--card-shadow)',
                            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                        }}
                    >
                        {loading ? 'AI Working...' : <><Sparkles size={18} /> Generate Draft</>}
                    </button>
                </div>

                {/* SPLIT SCREEN area */}
                <div className="split-screen" style={{ flex: 1, display: 'flex', gap: '1rem', overflow: 'hidden', minHeight: 0 }}>

                    {!generatedContent && !loading && (
                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border-color)' }}>
                            <p style={{ fontSize: '1.1rem' }}>Choose a template and click <b>Generate</b> to begin mapping the future.</p>
                        </div>
                    )}

                    {loading && (
                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                            <div className="spinner" style={{ width: '50px', height: '50px', border: '5px solid var(--border-color)', borderTop: '5px solid var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <p style={{ marginTop: '1.5rem', fontWeight: 600 }}>Synthesizing professional document...</p>
                        </div>
                    )}

                    {generatedContent && !loading && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                            <div style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Pencil size={14} /> Rich Text Editor <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>(Auto-Syncing)</span>
                            </div>
                            <div style={{ flex: 1, borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <EditableContent initialContent={generatedContent} onChange={setGeneratedContent} />
                            </div>
                        </div>
                    )}

                    {generatedContent && !loading && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                            <div style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>📄 PDF Synchronizer (75%)</span>
                                {isGeneratingPdf && <span style={{ color: 'var(--accent-color)', animation: 'pulse 1s infinite' }}>● Syncing</span>}
                            </div>
                            <div style={{ flex: 1, background: '#525659', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    pointerEvents: 'none', zIndex: 0,
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        fontSize: '5rem',
                                        fontWeight: '900',
                                        color: 'rgba(255,255,255,0.06)',
                                        transform: 'rotate(-35deg)',
                                        userSelect: 'none',
                                        letterSpacing: '0.3em',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        DRAFT &nbsp; DRAFT &nbsp; DRAFT
                                    </div>
                                </div>
                                {pdfUrl ? (
                                    <iframe src={pdfUrl + "#toolbar=0&navpanes=0&zoom=75"} style={{ width: '100%', height: '100%', border: 'none', position: 'relative', zIndex: 1 }} title="PDF Preview" />
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', position: 'relative', zIndex: 1 }}>Finalizing pixels...</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                {generatedContent && (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', flexShrink: 0 }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                📧 Messaging:
                            </label>
                            <textarea
                                value={emailBody}
                                onChange={e => setEmailBody(e.target.value)}
                                style={{
                                    width: '100%', height: '80px', borderRadius: '10px',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)',
                                    padding: '12px', fontSize: '0.9rem', resize: 'none', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleDownloadPDF}
                                style={{
                                    background: 'var(--bg-secondary)', border: '2px solid var(--accent-color)', color: 'var(--accent-color)',
                                    padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
                                    display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', justifyContent: 'center'
                                }}
                            >
                                <Download size={18} /> <span className="hide-mobile">PDF</span>
                            </button>
                            <button
                                id="agreementEmailBtn"
                                onClick={handleSendEmail}
                                style={{
                                    background: 'var(--accent-color)', border: 'none', color: 'white',
                                    padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: 'var(--card-shadow)',
                                    display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', justifyContent: 'center'
                                }}
                            >
                                <Send size={18} /> <span className="hide-mobile">Send Email</span>
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default AgreementLetterModal;
