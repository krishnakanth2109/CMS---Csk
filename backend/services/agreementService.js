/**
 * Agreement AI Service — Generates the exact agreement template
 * Ported from Python AgreementAIService
 */

const COMPANY_ADDRESSES = {
    'Arah Infotech Pvt Ltd': 'Ground Floor, Shanmukh Emmpire, Ayyappa Society, Main Road, Madhapur, Hyderabad, Telangana - 500081',
    'VAGARIOUS SOLUTIONS PVT LTD': 'Plot No. 1208, Flat No. 201, 2nd Floor, Spline Arcade, Ayyappa Society Main Road, Sri Sai Nagar, Madhapur, Hyderabad, Telangana - 500081',
    'UP LIFE INDIA PVT LTD': 'Ground Floor, Shanmukh Emmpire, 83, Ayyappa Society, Mega Hills, Madhapur, Hyderabad, Telangana - 500081',
    'ZERO7 TECHNOLOGIES TRAINING & DEVELOPMENT': 'Ground Floor, Shanmukh Emmpire, Ayyappa Society, Main Road, Madhapur, Hyderabad, Telangana - 500081',
};

export function generateAgreement(data, letterType = 'Agreement') {
    const company = data.company_name || 'Arah Infotech Pvt Ltd';
    const partnerCompany = data.name || 'Partner Company';
    const percentage = data.percentage || 0;
    const partnerAddress = data.address || '';

    let joiningDate = data.joining_date || data.current_date || new Date();

    if (joiningDate) {
        const d = new Date(joiningDate);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            joiningDate = `${day}-${month}-${year}`;
        } else {
            if (typeof joiningDate === 'string') {
                if (joiningDate.includes('T')) joiningDate = joiningDate.split('T')[0];
            }
        }
    }

    const replacement = data.replacement || 60;
    const invoicePostJoining = data.invoice_post_joining || 45;
    const paymentRelease = data.payment_release || 15;
    const signature = data.signature || 'Authorized Signatory';

    // Split signature into name and designation
    let sigName = signature;
    let sigDesignation = '';
    if (signature.includes(' - ')) {
        const parts = signature.split(' - ');
        sigName = parts[0].trim();
        sigDesignation = parts[1].trim();
    }

    // Look up company address (case-insensitive match)
    let companyAddress = '';
    for (const [key, addr] of Object.entries(COMPANY_ADDRESSES)) {
        if (key.toLowerCase().includes(company.toLowerCase()) || company.toLowerCase().includes(key.toLowerCase())) {
            companyAddress = addr;
            break;
        }
    }
    if (!companyAddress) {
        if (company.toUpperCase().includes('VAGARIOUS')) {
            companyAddress = COMPANY_ADDRESSES['VAGARIOUS SOLUTIONS PVT LTD'];
        } else {
            companyAddress = COMPANY_ADDRESSES['Arah Infotech Pvt Ltd'] || '';
        }
    }

    let shortCompany = company;
    let referredName = company;
    let headingCompany = company.toUpperCase();

    if (company.toUpperCase().includes('VAGARIOUS')) {
        shortCompany = 'Vagarious Solutions';
        referredName = 'Vagarious Solutions';
    }

    return `<div style="font-family: Arial, Helvetica, sans-serif; color: #000; line-height: 1.6; max-width: 800px; margin: 0 auto; text-align: justify; padding-bottom: 50px;">

<h3 style="text-align: center; text-decoration: underline; font-size: 13px; margin-bottom: 30px; word-wrap: break-word; overflow-wrap: break-word;">AGREEMENT B/W ${headingCompany} - ${partnerCompany.toUpperCase()}</h3>

<p style="margin-bottom: 20px;">This Agreement is made and entered into on <strong>${joiningDate}</strong> by and between:</p>

<p style="margin-bottom: 5px;"><strong>${headingCompany}</strong></p>
<p style="margin-bottom: 5px;">Registered Office: ${companyAddress}</p>
<p style="margin-bottom: 20px;">(Hereinafter referred to as &ldquo;${referredName}&rdquo; or the &ldquo;Service Provider&rdquo;) <strong>AND</strong></p>

<p style="margin-bottom: 5px;"><strong>${partnerCompany}</strong></p>
<p style="margin-bottom: 5px;">${partnerAddress}</p>
<p style="margin-bottom: 20px;">&ldquo;Parties.&rdquo;</p>


<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">RECITALS</h4>
<p>WHEREAS, the Client is engaged in the field of Information Technology and Services;</p>
<p>WHEREAS, ${shortCompany} is engaged in human resource management and consultancy services, including recruitment, training, and business process outsourcing;</p>
<p>WHEREAS, the Client desires to avail recruitment services, and ${shortCompany} has represented that it possesses the skills, expertise, and resources to provide such services;</p>
<p><strong>NOW, THEREFORE,</strong> in consideration of the mutual covenants herein, the Parties agree as follows:</p>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">1. CONTRACT TERM</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>This Agreement shall remain valid for 12 months from the date of signing unless terminated earlier as per Clause 11.</li>
<li>Upon expiry, this Agreement may be extended by mutual written consent.</li>
<li>The Client reserves the right to appoint multiple vendors. ${shortCompany} acknowledges that its appointment is non-exclusive.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">2. PROFESSIONAL FEES</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>The Client shall pay ${shortCompany} professional charges as follows:</li>
<li>All Levels &ndash; <strong>${percentage}%</strong> of Annual CTC (Applicable GST extra).</li>
<li>Annual CTC shall include Basic Salary, HRA, PF, LTA, Medical, Conveyance, and other fixed allowances. It shall exclude sales incentives, performance bonuses, and stock options.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">3. SERVICE METHODOLOGY</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>The Client shall share requirements via email/telephone.</li>
<li>${shortCompany} shall confirm within 7 working days its ability to provide candidates.</li>
<li>${shortCompany} shall shortlist and submit resumes matching the Client&rsquo;s requirements.</li>
<li>The Client shall review resumes and provide feedback within 2 working days. During this time, ${shortCompany} shall not propose the same candidates elsewhere.</li>
<li>If the Client confirms a candidate already exists in its database, no fee shall apply.</li>
<li>${shortCompany} shall coordinate interviews and follow up until candidate joining.</li>
<li>If a candidate is hired within 3 months of initial submission (including via Client advertisements), service charges shall apply.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">4. INVOICES &amp; PAYMENT TERMS</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>On confirmation of candidate joining, ${shortCompany} shall raise an invoice <strong>${invoicePostJoining} days</strong> post joining.</li>
<li>The Client shall process payment within <strong>${paymentRelease} days</strong> of invoice date, after deduction of applicable taxes.</li>
<li>Fees are payable irrespective of whether the candidate is on trial or probation.</li>
<li>No payment is due if a candidate absconds or resigns within 90 days of joining.</li>
<li>In case of duplicate referrals, payment shall be made to the vendor whose reference was received first.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">5. REPLACEMENT GUARANTEE</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>If a candidate absconds in <strong>${replacement} Days</strong> replacement is applicable and ${shortCompany} shall provide a replacement within 10 working days.</li>
<li>If the candidate is terminated due to misconduct, breach of confidentiality, or non-performance by the company after <strong>60 days</strong>, ${shortCompany} shall not provide a replacement, but, if he is terminated in 60 Days ${shortCompany.toLowerCase()} will provide replacement.</li>
<li>If replacement is not provided, the professional fee shall be refunded or adjusted against future invoices.</li>
<li>This guarantee does not apply if the Client terminates for business reasons.</li>
<li>The Client shall provide 1-week prior notice to ${shortCompany} before termination for this guarantee to apply.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">6. RESPONSIBILITIES OF ${shortCompany.toUpperCase()}</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>Deliver services diligently and promote the Client&rsquo;s interests.</li>
<li>Not forward selected candidates to other clients until released by the Client.</li>
<li>Arrange interviews at mutually convenient times.</li>
<li>Notify the Client if a proposed candidate accepts another assignment.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">7. CONFIDENTIALITY &amp; NON-SOLICITATION</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>${shortCompany} shall not disclose Client&rsquo;s confidential information or business practices.</li>
<li>${shortCompany} shall not solicit or influence Client employees.</li>
<li>This clause survives the termination of this Agreement</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">8. NON-ASSIGNMENT</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>This Agreement shall not be assigned by ${shortCompany} to any third party without prior written consent of the Client.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">9. DISPUTE RESOLUTION &amp; ARBITRATION</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>Any dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996.</li>
<li>A sole arbitrator shall be appointed with mutual consent.</li>
<li>The arbitration shall be conducted in Hyderabad, in the English language.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">10. GOVERNING LAW &amp; JURISDICTION</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>This Agreement shall be governed by the laws of India. Courts at Hyderabad and Secunderabad shall have exclusive jurisdiction.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">11. TERMINATION</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>Either Party may terminate this Agreement with 30 days&rsquo; prior written notice.</li>
<li>The Client may terminate immediately without notice if ${shortCompany} breaches terms.</li>
<li>No service fee shall be payable for placements made after termination unless the Agreement is renewed.</li>
</ul>
</div>

<div class="section-block">
<h4 style="color: #3b82f6; margin-top: 25px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase;">12. ENTIRE AGREEMENT</h4>
<ul style="list-style-type: disc; margin-left: 15px; padding-left: 15px; margin-top: 0;">
<li>This Agreement constitutes the entire understanding between the Parties and supersedes all prior discussions. Any amendments shall be in writing and signed by both Parties.</li>
</ul>
</div>

<p style="margin-bottom: 20px;"><strong>IN WITNESS WHEREOF,</strong> the Parties hereto have executed this Agreement on the date first above written.</p>

<table class="signature-table" style="width: 100%; border: none; border-collapse: collapse; margin-top: 20px;">
<tbody>
<tr>
<td style="text-align: left; width: 50%; border: none; vertical-align: top; padding: 0;"><strong>${headingCompany}</strong></td>
<td style="text-align: left; width: 50%; border: none; vertical-align: top; padding: 0;"><strong>${partnerCompany}</strong></td>
</tr>
<tr>
<td style="border: none; padding: 60px 0 10px 0;"></td>
<td style="border: none; padding: 60px 0 10px 0;"></td>
</tr>
<tr>
<td style="border: none; padding: 5px 0 0 0; text-align: left;"><strong>NAME: </strong>${sigName}</td>
<td style="border: none; padding: 5px 0 0 0; text-align: left;"><strong>NAME: </strong></td>
</tr>
<tr>
<td style="border: none; padding: 5px 0 0 0; text-align: left;"><strong>DESIGNATION: </strong>${sigDesignation || 'MANAGING DIRECTOR'}</td>
<td style="border: none; padding: 5px 0 0 0; text-align: left;"><strong>DESIGNATION: </strong></td>
</tr>
</tbody>
</table>
</div>`;
}
