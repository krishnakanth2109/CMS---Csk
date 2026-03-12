import Candidate from '../models/Candidate.js';
import xlsx from 'xlsx';
import fs from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flexible column finder:
 * Pass 1 – exact normalized match
 * Pass 2 – key starts-with a name that is ≥ 4 chars
 * Pass 3 – key contains a name that is ≥ 4 chars (loose match)
 */
const findColumn = (rowKeys, ...possibleNames) => {
  const normalized = possibleNames.map(n => n.toLowerCase().replace(/[\s_\-\.]+/g, ''));

  // Pass 1: Exact match
  for (const key of rowKeys) {
    const keyNorm = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
    if (normalized.includes(keyNorm)) return key;
  }

  // Pass 2: Key starts-with a possible name (≥4 chars)
  for (const key of rowKeys) {
    const keyNorm = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
    for (const name of normalized) {
      if (name.length >= 4 && keyNorm.startsWith(name)) return key;
    }
  }

  // Pass 3: Key contains a possible name (≥4 chars)
  for (const key of rowKeys) {
    const keyNorm = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
    for (const name of normalized) {
      if (name.length >= 4 && keyNorm.includes(name)) return key;
    }
  }

  return null;
};

const getValue = (row, columnKey) => {
  if (!columnKey || !(columnKey in row)) return '';
  const val = row[columnKey];
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    const str = val.toString();
    // Handle scientific notation from Excel
    if (str.toLowerCase().includes('e+') || str.toLowerCase().includes('e-')) {
      return Math.round(val).toString();
    }
    return str;
  }
  return val.toString().trim();
};

const VALID_STATUSES = [
  'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'No Show', 'Selected', 'Joined', 'Rejected', 'Pipeline', 'Hold', 'Backout'
];

/**
 * Get the next available VTS number from MongoDB.
 * Matches the Candidate.js auto-ID format: VTS0000001, VTS0000002, ...
 */
const getNextCandidateNumber = async () => {
  const last = await Candidate.findOne(
    { candidateId: { $regex: /^VTS\d+$/i } },
    { candidateId: 1 }
  ).sort({ createdAt: -1 });

  if (!last || !last.candidateId) return 1;
  const num = parseInt(last.candidateId.replace(/^VTS/i, ''), 10);
  return isNaN(num) ? 1 : num + 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER
// @route  POST /api/candidates/bulk-import
// @access Private
//
// STRATEGY:
//  - Accept ANY excel format - map columns flexibly
//  - Only skip rows that are completely empty
//  - If no valid email, generate a placeholder so the row still saves
//  - UPSERT by email: existing email → UPDATE, new email → CREATE
//  - New candidates saved SEQUENTIALLY to guarantee unique IDs
// ─────────────────────────────────────────────────────────────────────────────
export const bulkImportCandidates = async (req, res) => {
  const tempFilePath = req.file?.path;

  console.log('=== BULK IMPORT START ==='); 
  console.log('User:', req.user ? `${req.user._id} / ${req.user.firstName} ${req.user.lastName}` : 'NONE');
  console.log('File:', tempFilePath);

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // ── 1. Read workbook ──────────────────────────────────────────────────
    const fileBuffer = fs.readFileSync(tempFilePath);
    const workbook   = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName  = workbook.SheetNames[0];
    const worksheet  = workbook.Sheets[sheetName];
    const data       = xlsx.utils.sheet_to_json(worksheet, { defval: '', raw: false });

    if (!data || data.length === 0) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ success: false, message: 'Excel file is empty or has no data rows.' });
    }

    const rowKeys = Object.keys(data[0] || {});
    console.log('Columns detected:', rowKeys);
    console.log('Total data rows:', data.length);

    // ── 2. Map columns (very flexible — tries many aliases) ───────────────
    const cols = {
      name        : findColumn(rowKeys, 'name', 'candidatename', 'fullname', 'candidate', 'applicant', 'applicantname'),
      email       : findColumn(rowKeys, 'email', 'emailid', 'emailaddress', 'mail', 'emailid'),
      contact     : findColumn(rowKeys, 'contact', 'phone', 'mobile', 'mobileno', 'phoneno', 'contactno', 'phonenumber', 'mobilenumber', 'contactnumber', 'cellphone'),
      position    : findColumn(rowKeys, 'position', 'jobtitle', 'designation', 'role', 'jobposition', 'appliedfor', 'appliedposition'),
      client      : findColumn(rowKeys, 'client', 'clientname', 'clientcompany', 'hiringclient', 'company', 'companyname', 'organization'),
      skills      : findColumn(rowKeys, 'skills', 'skill', 'technologies', 'techstack', 'keyskills', 'technicalskills'),
      location    : findColumn(rowKeys, 'currentlocation', 'location', 'city', 'loc', 'presentlocation', 'place'),
      prefLocation: findColumn(rowKeys, 'preferredlocation', 'preflocation', 'preferredcity', 'jobcity'),
      exp         : findColumn(rowKeys, 'totalexperience', 'totalexp', 'experience', 'yoe', 'yearsofexperience', 'totalyears', 'exp'),
      relExp      : findColumn(rowKeys, 'relevantexperience', 'relevantexp', 'relexp', 'relatedexperience'),
      // ectc BEFORE ctc so "ECTC" columns don't match ctc first
      ectc        : findColumn(rowKeys, 'ectc', 'expectedctc', 'expectedsalary', 'expctc', 'expectedpackage', 'expectedcost'),
      ctc         : findColumn(rowKeys, 'ctc', 'currentctc', 'currentsalary', 'currentpackage', 'currentcost'),
      takeHome    : findColumn(rowKeys, 'takehome', 'takehomesalary', 'inhands', 'inhandsalary', 'netsalary'),
      notice      : findColumn(rowKeys, 'noticeperiod', 'notice', 'np', 'noticetime', 'noticeduration'),
      remarks     : findColumn(rowKeys, 'remarks', 'feedback', 'comments', 'notes', 'comment'),
      source      : findColumn(rowKeys, 'source', 'reference', 'referral', 'sourceofcandidate', 'candidatesource'),
      status      : findColumn(rowKeys, 'status', 'candidatestatus', 'currentstatus', 'stage'),
      company     : findColumn(rowKeys, 'currentcompany', 'presentcompany', 'employer', 'currentorganization', 'workingat'),
      education   : findColumn(rowKeys, 'education', 'qualification', 'degree', 'highestqualification', 'academicqualification'),
      gender      : findColumn(rowKeys, 'gender', 'sex'),
      linkedin    : findColumn(rowKeys, 'linkedin', 'linkedinurl', 'linkedinprofile', 'linkedinid'),
      industry    : findColumn(rowKeys, 'industry', 'sector', 'domain', 'industrytype'),
      dob         : findColumn(rowKeys, 'dob', 'dateofbirth', 'birthdate', 'birthday'),
    };

    console.log('Column map:', cols);

    // ── 3. Parse rows — VERY LENIENT, only skip fully empty rows ─────────
    const validRows     = [];
    const mappingErrors = [];

    data.forEach((row, index) => {
      const rowNum = index + 2; // Excel row number (1-indexed + header)
      try {
        // Extract all values
        const name     = getValue(row, cols.name).trim();
        const email    = getValue(row, cols.email).toLowerCase().trim();
        const contact  = getValue(row, cols.contact).replace(/[^\d\+\-\s]/g, '').trim();
        const position = getValue(row, cols.position).trim();
        const client   = getValue(row, cols.client).trim();
        const skills   = getValue(row, cols.skills).trim();

        // Skip row if ALL key identifiable fields are empty
        const hasAnyData = name || email || contact || position || client || skills;
        if (!hasAnyData) {
          console.log(`Row ${rowNum}: Skipping empty row`);
          return;
        }

        // Clean phone number — keep digits only, limit to 10
        const cleanContact = contact.replace(/\D/g, '').slice(-10) || '';

        // Parse skills — handle comma, semicolon, pipe, newline separation
        const skillsArray = skills
          ? skills.split(/[,;|\n]+/).map(s => s.trim()).filter(Boolean)
          : [];

        // Parse status — accept any comma/semicolon/pipe separated values
        const statusRaw    = getValue(row, cols.status).trim();
        const parsedStatus = statusRaw
          ? statusRaw.split(/[,;|]+/).map(s => s.trim()).filter(s => VALID_STATUSES.includes(s))
          : [];
        // If status in Excel doesn't match valid list, still use it if not empty
        const statusFromExcel = statusRaw && parsedStatus.length === 0
          ? ['Submitted'] // default fallback
          : parsedStatus;
        const finalStatus = statusFromExcel.length > 0 ? statusFromExcel : ['Submitted'];

        // Generate placeholder email if missing (to allow saving)
        const finalEmail = email && email.includes('@')
          ? email
          : `imported_${Date.now()}_${rowNum}@placeholder.com`;

        validRows.push({
          rowNum,
          candidateData: {
            name              : name || 'Unknown',
            email             : finalEmail,
            contact           : cleanContact,
            position          : position,
            client            : client,
            skills            : skillsArray,
            status            : finalStatus,
            currentLocation   : getValue(row, cols.location)     || '',
            preferredLocation : getValue(row, cols.prefLocation)  || '',
            totalExperience   : getValue(row, cols.exp)           || '',
            relevantExperience: getValue(row, cols.relExp)        || '',
            ctc               : getValue(row, cols.ctc)           || '',
            ectc              : getValue(row, cols.ectc)          || '',
            takeHomeSalary    : getValue(row, cols.takeHome)      || '',
            noticePeriod      : getValue(row, cols.notice)        || '',
            remarks           : getValue(row, cols.remarks)       || '',
            source            : getValue(row, cols.source)        || 'Excel Import',
            currentCompany    : getValue(row, cols.company)       || '',
            education         : getValue(row, cols.education)     || '',
            gender            : getValue(row, cols.gender)        || '',
            linkedin          : getValue(row, cols.linkedin)      || '',
            industry          : getValue(row, cols.industry)      || '',
            dateOfBirth       : getValue(row, cols.dob)           || '',
            recruiterId       : req.user._id,
            recruiterName     : `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
            active            : true,
            dateAdded         : new Date(),
          }
        });

      } catch (err) {
        console.error(`Row ${rowNum} parse error:`, err.message);
        mappingErrors.push({ row: rowNum, candidate: 'Unknown', error: `Parse error: ${err.message}` });
      }
    });

    console.log(`Validated: ${validRows.length} valid rows, ${mappingErrors.length} parse errors`);

    if (validRows.length === 0) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        message: 'No data rows found in the Excel file. Please check the file has data below the header row.',
        errors : mappingErrors.slice(0, 20),
      });
    }

    // ── 4. Split into NEW vs EXISTING (by email) ──────────────────────────
    // Only match non-placeholder emails
    const realEmails   = validRows
      .map(r => r.candidateData.email)
      .filter(e => !e.includes('@placeholder.com'));

    const existingDocs = realEmails.length > 0
      ? await Candidate.find({ email: { $in: realEmails } }, { email: 1 })
      : [];
    const existingSet  = new Set(existingDocs.map(d => d.email.toLowerCase()));

    const newRows    = validRows.filter(r => !existingSet.has(r.candidateData.email) || r.candidateData.email.includes('@placeholder.com'));
    const updateRows = validRows.filter(r =>  existingSet.has(r.candidateData.email) && !r.candidateData.email.includes('@placeholder.com'));

    console.log(`New: ${newRows.length}, Existing to update: ${updateRows.length}`);

    // ── 5a. CREATE new candidates — SEQUENTIALLY to guarantee unique IDs ──
    let createdCount = 0;

    if (newRows.length > 0) {
      let nextNum = await getNextCandidateNumber();
      console.log(`Starting candidateId from: VTS${nextNum.toString().padStart(7, '0')}`);

      for (const row of newRows) {
        try {
          row.candidateData.candidateId = `VTS${nextNum.toString().padStart(7, '0')}`;
          nextNum++;

          const doc = new Candidate(row.candidateData);
          await doc.save();
          createdCount++;
          console.log(`✓ Created ${row.candidateData.candidateId} — ${row.candidateData.name}`);
        } catch (err) {
          const msg = err.message || String(err);
          console.error(`✗ CREATE failed Row ${row.rowNum} (${row.candidateData.name}):`, msg);
          mappingErrors.push({ row: row.rowNum, candidate: row.candidateData.name, error: `Create failed: ${msg}` });
        }
      }
    }

    // ── 5b. UPDATE existing candidates ───────────────────────────────────
    let updatedCount = 0;

    if (updateRows.length > 0) {
      const updateResults = await Promise.allSettled(
        updateRows.map(r => {
          const { recruiterId, recruiterName, dateAdded, candidateId, active, ...updateFields } = r.candidateData;

          // Drop empty strings/arrays so existing data is preserved
          const cleanFields = Object.fromEntries(
            Object.entries(updateFields).filter(([, v]) =>
              v !== '' && !(Array.isArray(v) && v.length === 0)
            )
          );

          return Candidate.findOneAndUpdate(
            { email: r.candidateData.email },
            { $set: cleanFields },
            { new: true, runValidators: false }
          );
        })
      );

      updateResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          updatedCount++;
          console.log(`✓ Updated — ${updateRows[idx].candidateData.name}`);
        } else {
          const msg  = result.reason?.message || 'Update failed';
          const name = updateRows[idx].candidateData.name;
          const rowN = updateRows[idx].rowNum;
          console.error(`✗ UPDATE failed Row ${rowN} (${name}):`, msg);
          mappingErrors.push({ row: rowN, candidate: name, error: `Update failed: ${msg}` });
        }
      });
    }

    // ── 6. Cleanup & respond ──────────────────────────────────────────────
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    const totalProcessed = createdCount + updatedCount;
    console.log(`=== DONE: ${createdCount} created, ${updatedCount} updated, ${mappingErrors.length} errors ===`);

    return res.status(200).json({
      success   : true,
      message   : `Import complete: ${createdCount} new candidate(s) added, ${updatedCount} existing updated.`,
      imported  : totalProcessed,
      created   : createdCount,
      updated   : updatedCount,
      duplicates: updatedCount,
      total     : data.length,
      errors    : mappingErrors.length > 0 ? mappingErrors.slice(0, 50) : undefined,
    });

  } catch (error) {
    console.error('BULK IMPORT CRITICAL ERROR:', error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
    return res.status(500).json({
      success: false,
      message: 'Critical server error during import.',
      error  : error.message,
    });
  }
};