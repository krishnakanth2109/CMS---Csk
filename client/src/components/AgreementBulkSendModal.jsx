import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const COMPANY_TEMPLATES = [
    { label: 'Arah Infotech', value: '/Arah_Template.pdf', defaultName: 'Arah Infotech Pvt Ltd' },
    { label: 'UPlife', value: '/UPlife.pdf', defaultName: 'UP LIFE INDIA PVT LTD' },
    { label: 'Vagarious', value: '/Vagerious.pdf', defaultName: 'VAGARIOUS SOLUTIONS PVT LTD' },
    { label: 'Zero7', value: '/Zero7_A4.jpg', defaultName: 'ZERO7 TECHNOLOGIES TRAINING & DEVELOPMENT' },
];

const AgreementBulkSendModal = ({ selectedCount, onClose, onConfirm }) => {
    const [selectedTemplate, setSelectedTemplate] = useState('/Arah_Template.pdf');
    const [companyName, setCompanyName] = useState('Arah Infotech Pvt Ltd');

    const handleTemplateChange = (e) => {
        const newVal = e.target.value;
        setSelectedTemplate(newVal);
        const templateObj = COMPANY_TEMPLATES.find(t => t.value === newVal);
        if (templateObj) {
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
            backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 4000
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'var(--bg-secondary)',
                    padding: '2rem',
                    borderRadius: '16px',
                    width: '400px',
                    boxShadow: 'var(--card-shadow)',
                    position: 'relative'
                }}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '15px', right: '15px',
                        background: 'transparent', border: 'none',
                        color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer'
                    }}
                >
                    &times;
                </button>

                <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Bulk Draft Settings
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Generating and sending <strong>{selectedCount}</strong> agreements.
                </p>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Template Background</label>
                    <select
                        value={selectedTemplate}
                        onChange={handleTemplateChange}
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: '8px',
                            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)', outline: 'none'
                        }}
                    >
                        {COMPANY_TEMPLATES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hiring Company Name</label>
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: '8px',
                            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)', outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 16px', borderRadius: '8px', border: 'none',
                            background: 'transparent', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontWeight: 600
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: 'none',
                            background: 'var(--accent-color)', color: 'white',
                            cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 10px rgba(99,102,241,0.3)'
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
