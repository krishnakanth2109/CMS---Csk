import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { API_URL } from '../config';
import { Building2, ArrowRight, ChevronDown, Download } from 'lucide-react';

const InputGroup = ({ label, name, type = "text", placeholder, value, onChange, disabled, required = false, options = null, error = false }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: '700',
            color: 'var(--text-muted)'
        }}>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        {options ? (
            <div style={{ position: 'relative' }}>
                <select
                    name={name}
                    value={value}
                    onChange={onChange}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', display: 'flex' }}>
                    <ChevronDown size={18} />
                </div>
            </div>
        ) : (
            <input
                type={type}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                disabled={disabled}
                required={required}
                autoComplete="off"
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: disabled ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    border: error ? '2px solid #ef4444' : '1px solid var(--border-color)',
                    borderRadius: '12px',
                    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                    cursor: disabled ? 'not-allowed' : 'text'
                }}
                onFocus={(e) => { if (!disabled && !error) { e.target.style.borderColor = 'var(--accent-color)'; e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)' } }}
                onBlur={(e) => { if (!error) e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none' }}
            />
        )}
    </div>
);

const AddCompanyModal = ({ onClose, onSave, initialData, isViewOnly }) => {
    const [formData, setFormData] = useState(() => {
        if (initialData) {
            const existingSig = initialData.signature || '';
            const sigParts = existingSig.includes(' - ') ? existingSig.split(' - ') : [existingSig, ''];
            const pct = initialData.compensation?.percentage ?? initialData.percentage ?? 0;
            let jd = initialData.joining_date || '';
            if (jd && jd.includes('T')) jd = jd.split('T')[0];

            return {
                emp_id: initialData.emp_id || '',
                name: initialData.name || '',
                email: initialData.email || '',
                percentage: pct,
                joining_date: jd,
                address: initialData.address || '',
                replacement: initialData.replacement || '',
                invoice_post_joining: initialData.invoice_post_joining || '',
                payment_release: initialData.payment_release || '',
                sig_name: sigParts[0]?.trim() || '',
                sig_designation: sigParts[1]?.trim() || '',
            };
        }
        return {
            emp_id: '',
            name: '',
            email: '',
            percentage: '',
            joining_date: '',
            address: '',
            replacement: '',
            sig_name: '',
            sig_designation: '',
            invoice_post_joining: '',
            payment_release: ''
        };
    });

    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        let { name, value } = e.target;

        if (name === 'email') {
            const lowerVal = value.toLowerCase();
            const dotComIndex = lowerVal.indexOf('.com');
            if (dotComIndex !== -1 && value.length > dotComIndex + 4) {
                value = value.substring(0, dotComIndex + 4);
            }
        }

        if (name === 'name') {
            value = value.replace(/[^a-zA-Z\s]/g, '');
            if (value.length > 0) {
                value = value.replace(/\b\w/g, c => c.toUpperCase());
            }
        }

        if (name === 'sig_name') {
            value = value.replace(/[^a-zA-Z\s]/g, '');
            if (value.length > 0) {
                value = value.replace(/\b\w/g, c => c.toUpperCase());
            }
        }

        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const sigName = formData.sig_name?.trim() || '';
        const sigDesig = formData.sig_designation?.trim() || '';
        const signature = sigDesig ? `${sigName} - ${sigDesig}` : sigName;

        const payload = {
            emp_id: formData.emp_id || '',
            name: formData.name || '',
            email: formData.email || '',
            percentage: formData.percentage ? parseFloat(formData.percentage) : 0,
            joining_date: formData.joining_date || null,
            address: formData.address || '',
            replacement: formData.replacement || '',
            invoice_post_joining: formData.invoice_post_joining || '',
            payment_release: formData.payment_release || '',
            signature,
        };
        onSave(payload);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(10px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 2000
        }}>
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="modal-content"
                style={{
                    background: 'var(--card-bg)',
                    width: '800px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--card-shadow)',
                    padding: '3rem',
                    borderRadius: '32px'
                }}
            >
                {/* Header */}
                <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '2.2rem',
                        fontWeight: '800',
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem'
                    }}>
                        {isViewOnly ? 'View Company Details' : initialData ? 'Update Company Details' : 'Add New Company'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem', fontWeight: '500' }}>
                        {isViewOnly ? 'Review details below.' : initialData ? 'Refine details for business agreement.' : 'Onboard a new company for agreement generation.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '2.5rem' }}>
                    <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Building2 size={20} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ borderBottom: '2px solid var(--accent-color)', paddingBottom: '4px', fontWeight: 'bold' }}>Company Information</span>
                        </h3>
                        <div className="form-grid-12">
                            <div style={{ gridColumn: 'span 6' }}>
                                <InputGroup label="Company Name" name="name" placeholder="e.g. Arah Infotech" value={formData.name} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 6' }}>
                                <InputGroup label="Email Contact" name="email" type="email" placeholder="contact@arah.com" value={formData.email} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 6' }}>
                                <InputGroup label="Date of Agreement" name="joining_date" type="date" value={formData.joining_date} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 6' }}>
                                <InputGroup label="Compensation %" name="percentage" type="number" placeholder="8.33" value={formData.percentage} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 12' }}>
                                <InputGroup label="Registered Office Address" name="address" placeholder="123 Tech Park, Hyderabad" value={formData.address} onChange={handleChange} required disabled={isViewOnly} />
                            </div>

                            <div style={{ gridColumn: 'span 4' }}>
                                <InputGroup label="Replacement (Days)" name="replacement" type="number" placeholder="e.g. 60" value={formData.replacement} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 4' }}>
                                <InputGroup label="Invoice (Days)" name="invoice_post_joining" type="number" placeholder="e.g. 45" value={formData.invoice_post_joining} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 4' }}>
                                <InputGroup label="Payment (Days)" name="payment_release" type="number" placeholder="e.g. 15" value={formData.payment_release} onChange={handleChange} required disabled={isViewOnly} />
                            </div>

                            <div style={{ gridColumn: 'span 6' }}>
                                <InputGroup label="Signatory Name" name="sig_name" placeholder="e.g. Navya S" value={formData.sig_name} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 6' }}>
                                <InputGroup label="Designation" name="sig_designation" placeholder="e.g. Managing Director" value={formData.sig_designation} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '2rem', borderTop: '2px solid var(--border-color)' }}>
                        <button type="button" onClick={() => window.open(`${API_URL}/agreement-companies/template`)} style={{
                            padding: '16px',
                            background: 'transparent',
                            border: '2px solid var(--success-text)',
                            color: 'var(--success-text)',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                             <Download size={18} /> Template
                        </button>
                        <button type="button" onClick={onClose} style={{
                            flex: 1,
                            padding: '16px',
                            background: isViewOnly ? 'var(--accent-color)' : 'transparent',
                            border: isViewOnly ? 'none' : '2px solid var(--border-color)',
                            color: isViewOnly ? 'white' : 'var(--text-primary)',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: isViewOnly ? '0 8px 20px -5px rgba(99, 102, 241, 0.4)' : 'none'
                        }}
                            onMouseOver={(e) => { if (!isViewOnly) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                            onMouseOut={(e) => { if (!isViewOnly) e.currentTarget.style.background = 'transparent'; }}
                        >
                            {isViewOnly ? 'Close' : 'Cancel'}
                        </button>
                        {!isViewOnly && (
                            <button type="submit" style={{
                                flex: 2,
                                padding: '16px',
                                background: 'var(--accent-color)',
                                border: 'none',
                                color: 'white',
                                fontSize: '1.1rem',
                                fontWeight: '800',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                boxShadow: '0 8px 20px -5px rgba(99, 102, 241, 0.4)',
                                transition: 'transform 0.1s, background 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                            }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent-color)'}
                                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {initialData ? 'Apply Updates' : 'Add Company'}
                                <ArrowRight size={20} />
                            </button>
                        )}
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default AddCompanyModal;
