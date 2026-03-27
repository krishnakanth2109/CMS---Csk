import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
const COMPANY_TEMPLATES = [
    { label: 'Vagarious', value: '/Vagerious.pdf', defaultName: 'VAGARIOUS SOLUTIONS PVT LTD' }
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AgreementBulkSendModal = ({ selectedCount, onClose, onConfirm }) => {
    const [selectedTemplate, setSelectedTemplate] = useState('/Vagerious.pdf');
    const [companyName, setCompanyName] = useState('VAGARIOUS SOLUTIONS PRIVATE LIMITED');

    const handleTemplateChange = (e) => {
        const newVal = e.target.value;
        setSelectedTemplate(newVal);
        const templateObj = COMPANY_TEMPLATES.find(t => t.value === newVal);
        if (templateObj && !companyName) {
            setCompanyName(templateObj.defaultName);
        }
    };

    const handleConfirm = () => {
        onConfirm(selectedTemplate, companyName);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 4000
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'white',
                    padding: '2rem',
                    borderRadius: '20px',
                    width: '420px',
                    maxWidth: '95vw',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    position: 'relative'
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '15px', right: '15px',
                        background: 'transparent', border: 'none',
                        color: '#64748b', fontSize: '1.5rem', cursor: 'pointer'
                    }}
                >
                    &times;
                </button>

                <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#0f172a', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} style={{ color: '#283086' }} /> Bulk Draft Settings
                </h2>
                <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Generating and sending <strong>{selectedCount}</strong> agreements.
                </p>

                {/* Background selection permanently set to Vagarious */}

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#334155' }}>Hiring Company Name</label>
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company Name"
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: '10px',
                            background: '#eef2ff', border: '1px solid #c7d2fe',
                            color: '#283086', fontWeight: 'bold', outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 16px', borderRadius: '10px', border: 'none',
                            background: 'transparent', color: '#334155',
                            cursor: 'pointer', fontWeight: 600
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', border: 'none',
                            background: '#283086', color: 'white',
                            cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 10px rgba(40,48,134,0.3)'
                        }}
                    >
                        Start Bulk Send
                    </button>
                </div>

            </motion.div>
        </div>
    );
};

export default AgreementBulkSendModal;
