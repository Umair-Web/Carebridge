const { meta } = require('../common');

module.exports = {
  meta: meta(
    'CB-API-2026-004',
    'API Reference',
    'Endpoint catalogue, authentication model, error handling, and real-time events for the CareBridge REST interface',
  ),

  body(b) {
    // ---------------------------------------------------------------- 1
    b.h(1, 'Introduction');

    b.h(2, 'Scope');

    b.p(
      'This document catalogues the CareBridge HTTP interface. It is intended for engineers ' +
      'maintaining the platform or building an additional client against it. Every endpoint is listed ' +
      'with its method, path, the role required to call it, and its purpose.',
    );

    b.h(2, 'Base Address and Versioning');

    b.p(
      'All endpoints are served under a single version prefix. Paths in this document are written ' +
      'relative to that prefix — an entry shown as POST /referrals is called at ' +
      'https://<backend-host>/v1/referrals.',
    );

    b.code(
      [
        'Base address    https://<backend-host>/v1',
        'Content type    application/json  (multipart/form-data for file upload)',
        'Authentication  Authorization: Bearer <access token>',
        '',
        'Health check    GET https://<backend-host>/',
        '                -> "CareBridge API is running"',
        '',
        'Static files    https://<backend-host>/uploads/<filename>',
      ].join('\n'),
    );

    b.h(2, 'Conventions Used in This Document');

    b.table(
      ['Column', 'Meaning'],
      [
        ['Method and path', 'The HTTP method and the path relative to the version prefix. A segment shown as :id is a path parameter.'],
        ['Role', 'The minimum role required. See the note below on administrator access.'],
        ['Purpose', 'What the endpoint does.'],
      ],
      [1.2, 4],
    );

    b.note(
      'Administrators can reach every endpoint',
      'The authorisation guard permits the administrator role unconditionally, before the endpoint\'s ' +
      'own role list is consulted. The role shown against each endpoint below is therefore the minimum ' +
      'role, not an exclusive one. Every endpoint in this document is callable by an administrator. ' +
      'This is deliberate, to support platform oversight, but it means an administrator credential is ' +
      'an unrestricted credential.',
      'warn',
    );

    // ---------------------------------------------------------------- 2
    b.h(1, 'Authentication Model');

    b.h(2, 'Credentials');

    b.table(
      ['Credential', 'Lifetime', 'Contents', 'Used for'],
      [
        ['Access token', '1 hour', 'User identity, role, name, and creating account', 'Every authenticated request, sent in the Authorization header'],
        ['Refresh token', '30 days', 'User identity only', 'Obtaining a new pair of tokens when the access token expires'],
      ],
      [1, 0.8, 1.8, 2],
    );

    b.h(2, 'Obtaining and Renewing a Session');

    b.code(
      [
        'POST /v1/auth/login',
        '{ "email": "doctor@example.com", "password": "..." }',
        '',
        '200 OK',
        '{',
        '  "success": true,',
        '  "accessToken":  "<jwt>",',
        '  "refreshToken": "<jwt>",',
        '  "user": { "id": "...", "role": "consultant", "name": "..." }',
        '}',
        '',
        '--- when the access token expires ---',
        '',
        'POST /v1/auth/refresh',
        '{ "refreshToken": "<jwt>" }',
        '',
        '200 OK  -> a NEW access token AND a NEW refresh token',
        '        Store both. Renewal is rolling; the previous refresh',
        '        token should be discarded.',
      ].join('\n'),
    );

    b.p(
      'Renewal is refused if the account is no longer active. Suspending an account therefore ends its ' +
      'sessions at the next renewal, within one hour.',
    );

    b.note(
      'There is no credential revocation list',
      'A refresh token remains cryptographically valid for its full thirty-day lifetime. The only ' +
      'server-side control is the account status check performed at renewal. If a credential is ' +
      'believed to be compromised, suspend the account — that is the effective revocation mechanism.',
      'warn',
    );

    b.h(2, 'Sign-In Preconditions');

    b.table(
      ['Condition', 'Result'],
      [
        ['Email not verified', 'Sign-in refused, with an indication that verification is outstanding so the client can offer to resend the code.'],
        ['Account pending approval', 'Sign-in refused. The account exists but has not been activated by an administrator.'],
        ['Account suspended', 'Sign-in refused.'],
        ['Account active and verified', 'Sign-in succeeds; a token pair is issued and a sign-in notification is raised.'],
      ],
      [1.2, 4],
    );

    b.h(2, 'Rate Limiting');

    b.p(
      'Authentication endpoints are limited to thirty requests per minute per client address. The limit ' +
      'covers registration, sign-in, renewal, one-time-password issue and verification, and password ' +
      'reset. Exceeding it returns HTTP 429.',
    );

    b.note(
      'Rate limiting is not applied elsewhere',
      'No other router carries a limit, including the file upload endpoint and the administrative ' +
      'surface. Adding a global limit is recorded as a recommendation in the Security and Compliance ' +
      'document.',
      'warn',
    );

    // ---------------------------------------------------------------- 3
    b.h(1, 'Response and Error Conventions');

    b.h(2, 'Response Shape');

    b.code(
      [
        'Success',
        '{ "success": true, "data": { ... } }',
        '',
        'Failure',
        '{ "success": false, "message": "Human-readable explanation" }',
      ].join('\n'),
    );

    b.h(2, 'Status Codes');

    b.table(
      ['Code', 'Meaning', 'Typical cause'],
      [
        ['200', 'Success', 'The request was processed.'],
        ['201', 'Created', 'A new record was created.'],
        ['400', 'Bad request', 'Validation failed — a missing field, a malformed identity or telephone number, or an invalid state transition.'],
        ['401', 'Unauthenticated', 'The token is absent, malformed, or expired. The client should renew and retry once.'],
        ['403', 'Forbidden', 'Authenticated, but the role is not permitted to call this endpoint.'],
        ['404', 'Not found', 'The referenced record does not exist, or is not visible to this caller.'],
        ['409', 'Conflict', 'A uniqueness constraint was violated — a duplicate email or professional registration number.'],
        ['429', 'Too many requests', 'The authentication rate limit was exceeded.'],
        ['500', 'Server error', 'An unhandled condition. The response body carries no internal detail.'],
        ['502', 'Upstream failure', 'A third-party service failed — most commonly email delivery when issuing a verification code.'],
      ],
      [0.6, 1.2, 3.4],
    );

    b.note(
      'There is no central error handler',
      'Errors are handled within individual controllers rather than by a single application-level ' +
      'handler. Response shapes are consistent in practice but are not enforced structurally. ' +
      'Introducing a central handler is recorded in the Maintenance and Support Guide.',
    );

    // ---------------------------------------------------------------- 4
    b.h(1, 'Authentication Endpoints');

    b.p('Base path /auth. These endpoints are public and are rate limited.');

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['POST /auth/register', 'Register a consultant, hospital, or laboratory. Creates the login and the role profile, issues an email verification code, and notifies all administrators. Administrator registration is refused.'],
        ['POST /auth/login', 'Authenticate and issue a token pair. Subject to the preconditions in section 2.3.'],
        ['POST /auth/refresh', 'Exchange a refresh token for a new pair. Refused if the account is not active.'],
        ['POST /auth/verify-email-otp', 'Verify an email address using the six-digit code.'],
        ['POST /auth/resend-email-otp', 'Issue a fresh code. Returns 502 if delivery fails.'],
        ['GET /auth/verify-email', 'Legacy link-based email verification, retained for compatibility.'],
        ['POST /auth/resend-verification', 'Legacy link-based verification resend.'],
        ['POST /auth/forgot-password', 'Issue a single-use, time-limited password reset link. Always returns success, so that registered addresses cannot be enumerated.'],
        ['POST /auth/reset-password', 'Set a new password using a reset token, and notify the user.'],
        ['GET /auth/platform-settings', 'Public branding — platform name, logo, colours, and favicon. Called before sign-in so the login page carries the operator\'s branding.'],
      ],
      [1.4, 4],
    );

    // ---------------------------------------------------------------- 5
    b.h(1, 'Referral Endpoints');

    b.p('Base path /referrals. All require authentication.');

    b.table(
      ['Method and path', 'Role', 'Purpose'],
      [
        ['GET /referrals/suggestions', 'consultant', 'Return hospitals ranked for a prospective referral by the matching engine.'],
        ['POST /referrals', 'consultant', 'Create a referral. Allocates a referral code, sets the response deadline from urgency, and persists the ranked escalation queue.'],
        ['GET /referrals/mine', 'consultant', 'The consultant\'s own referrals.'],
        ['GET /referrals/earnings', 'consultant', 'Earnings summary and commission breakdown.'],
        ['POST /referrals/withdraw', 'consultant', 'Request a withdrawal, subject to the minimum amount and available balance.'],
        ['GET /referrals/hospitals/:id/doctors', 'consultant, hospital', 'Doctors at a hospital, for selecting a named recipient.'],
        ['GET /referrals/inbox', 'hospital', 'Referrals awaiting this hospital\'s response.'],
        ['GET /referrals/hospital-all', 'hospital', 'All referrals ever directed to this hospital.'],
        ['PATCH /referrals/:id/accept', 'hospital', 'Accept a referral. A department assignment is required.'],
        ['PATCH /referrals/:id/reject', 'hospital', 'Reject a referral. A reason is required and is shown to the consultant.'],
        ['PATCH /referrals/:id/status', 'hospital', 'General status transition, underlying the two endpoints above.'],
        ['GET /referrals/:id', 'consultant, hospital', 'Full referral detail including the clinical notes timeline.'],
        ['PATCH /referrals/:id', 'consultant', 'Edit a referral. Permitted only while pending, accepted, or rejected.'],
        ['POST /referrals/:id/notes', 'consultant, hospital', 'Append a clinical note, typed as nursing or consultant.'],
      ],
      [1.7, 0.9, 3.2],
    );

    b.h(2, 'Creating a Referral');

    b.code(
      [
        'POST /v1/referrals',
        '{',
        '  "patientName": "...",',
        '  "cnic": "35201-1234567-1",        // encrypted at rest',
        '  "dateOfBirth": "1985-04-12",       // source of truth for age',
        '  "gender": "male",                  // male | female | other',
        '  "guardianRelation": "S/O",         // S/O | D/O | W/O',
        '  "guardianName": "...",',
        '  "phone": "03001234567",',
        '  "area": "Gulshan-e-Iqbal",',
        '  "urgency": "urgent",               // emergency | urgent | routine',
        '  "symptomsText": "chest pain, breathlessness",',
        '  "summaryNotes": "...",',
        '  "attachments": ["https://..."],',
        '  "targetHospitalId": "...",',
        '  "department": "Cardiology",',
        '  "targetDoctorId": "...",           // optional',
        '  "rankedHospitalPreferences": [     // the escalation queue',
        '    { "hospitalId": "...", "department": "Cardiology" }',
        '  ]',
        '}',
        '',
        '201 Created — the response carries the allocated referral code',
        '              and the response deadline derived from urgency.',
      ].join('\n'),
    );

    // ---------------------------------------------------------------- 6
    b.h(1, 'Hospital Endpoints');

    b.p('Base path /hospitals. The whole router requires the hospital role.');

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['GET /hospitals/dashboard', 'Headline figures for the hospital dashboard.'],
        ['GET /hospitals/analytics', 'Referral volume over time, for the dashboard chart.'],
        ['GET /hospitals/financial-ledger', 'Billed cases with amount billed, platform charge, and net position.'],
        ['GET /hospitals/referrals-pipeline', 'Accepted referrals not yet admitted.'],
        ['GET /hospitals/beds', 'Bed inventory by ward.'],
        ['PATCH /hospitals/beds', 'Update ward bed counts.'],
        ['PATCH /hospitals/departments', 'Update the departments the hospital operates. This determines referral eligibility.'],
        ['GET /hospitals/doctors', 'The hospital\'s doctor register.'],
        ['POST /hospitals/doctors', 'Add a doctor.'],
        ['PATCH /hospitals/doctors/:id', 'Update a doctor, including the availability flag.'],
        ['DELETE /hospitals/doctors/:id', 'Remove a doctor.'],
        ['GET /hospitals/admissions', 'Current and past admissions.'],
        ['POST /hospitals/admissions', 'Admit an accepted referral. Ward, room, bed, department, and treating doctor are all required.'],
        ['PATCH /hospitals/admissions/:id', 'Amend admission details.'],
        ['POST /hospitals/admissions/:id/complete', 'Bill and close a case. Computes the commercial split, closes the referral, and accrues the consultant commission. Idempotent.'],
        ['GET /hospitals/users', 'The hospital\'s team member accounts.'],
        ['POST /hospitals/users', 'Create a team member account.'],
        ['DELETE /hospitals/users/:id', 'Remove a team member, subject to the creation-chain check.'],
      ],
      [1.7, 4],
    );

    b.h(2, 'Completing and Billing a Case');

    b.code(
      [
        'POST /v1/hospitals/admissions/:id/complete',
        '{',
        '  "services": [',
        '    { "description": "Room charges (3 nights)", "amountPaisa": 4500000 },',
        '    { "description": "Consultant visit",        "amountPaisa":  800000 },',
        '    { "description": "Investigations",          "amountPaisa": 1200000 }',
        '  ],',
        '  "paymentMethod": "cash",',
        '  "paymentReference": "RCPT-8841",',
        '  "patientBillFileUrl": "https://..."',
        '}',
        '',
        'All amounts are WHOLE PAISA.  4500000 paisa = PKR 45,000.',
        '',
        'Effects, in order:',
        '  1. bill total computed from the service lines',
        '  2. commercial split computed by the commission engine',
        '  3. admission marked billed; referral closed',
        '  4. consultant commission accrued, with a terms snapshot',
        '  5. STATUS_UPDATE emitted to the consultant and the hospital',
        '',
        'Repeating this call on an already-billed admission returns',
        'without further financial effect.',
      ].join('\n'),
    );

    // ---------------------------------------------------------------- 7
    b.h(1, 'Laboratory Endpoints');

    b.h(2, 'Laboratory Management');

    b.p('Base path /labs. The whole router requires the laboratory role.');

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['GET /labs/me', 'The laboratory\'s own profile.'],
        ['GET /labs/dashboard', 'Referral counts by status.'],
        ['GET /labs/tests', 'The test catalogue.'],
        ['POST /labs/tests', 'Add a test with price and turnaround time.'],
        ['PATCH /labs/tests/:testId', 'Update a catalogue entry.'],
        ['DELETE /labs/tests/:testId', 'Remove a catalogue entry.'],
        ['GET /labs/users', 'Team member accounts.'],
        ['POST /labs/users', 'Create a team member account.'],
        ['DELETE /labs/users/:id', 'Remove a team member.'],
      ],
      [1.6, 4],
    );

    b.h(2, 'Laboratory Referrals');

    b.p('Base path /lab-referrals. Roles vary by endpoint.');

    b.table(
      ['Method and path', 'Role', 'Purpose'],
      [
        ['GET /lab-referrals/suggestions', 'consultant', 'Suggested laboratories for a prospective referral.'],
        ['POST /lab-referrals', 'consultant', 'Create a laboratory referral with an ordered test list and an optional discount, capped for that consultant.'],
        ['GET /lab-referrals/mine', 'consultant', 'The consultant\'s laboratory referrals.'],
        ['PATCH /lab-referrals/:id/re-refer', 'consultant', 'Redirect a rejected referral to a different laboratory, preserving the patient details.'],
        ['GET /lab-referrals/inbox', 'laboratory', 'Referrals awaiting a response.'],
        ['GET /lab-referrals/lab-all', 'laboratory', 'All referrals directed to this laboratory.'],
        ['PATCH /lab-referrals/:id/accept', 'laboratory', 'Accept a referral. An expected report date and time is required.'],
        ['PATCH /lab-referrals/:id/reject', 'laboratory', 'Reject a referral with a reason.'],
        ['POST /lab-referrals/:id/reports', 'laboratory', 'Upload report files. Notifies the consultant.'],
        ['PATCH /lab-referrals/:id/bill', 'laboratory', 'Price the ordered tests. The test list itself cannot be altered.'],
        ['PATCH /lab-referrals/:id/finalize', 'laboratory', 'Close and bill the referral. Computes the split and accrues the consultant commission.'],
        ['GET /lab-referrals/:id', 'consultant, laboratory', 'Full referral detail.'],
      ],
      [1.8, 1, 3],
    );

    b.h(2, 'Laboratory Administration');

    b.p(
      'Base path /admin/labs, requiring the administrator role. This router is mounted ahead of the ' +
      'general administrative router so that it takes precedence on the shared prefix.',
    );

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['GET /admin/labs', 'All laboratories.'],
        ['GET /admin/labs/:id', 'One laboratory in detail.'],
        ['PATCH /admin/labs/:id', 'Amend a laboratory profile.'],
        ['PATCH /admin/labs/:id/status', 'Activate, suspend, or set pending.'],
        ['GET /admin/labs/:id/consultant-overrides', 'Per-consultant commercial terms at this laboratory.'],
        ['POST /admin/labs/:id/consultant-overrides', 'Set a per-consultant override.'],
        ['GET /admin/labs/referrals', 'All laboratory referrals across the platform.'],
        ['PATCH /admin/labs/referrals/:id', 'Correct a laboratory referral.'],
        ['GET /admin/labs/payouts', 'Laboratory commission accruals.'],
      ],
      [2, 4],
    );

    // ---------------------------------------------------------------- 8
    b.h(1, 'Settlement Endpoints');

    b.h(2, 'Hospital Settlements');

    b.p('Base path /settlements. Roles vary by endpoint.');

    b.table(
      ['Method and path', 'Role', 'Purpose'],
      [
        ['GET /settlements/pending-admissions', 'hospital', 'Billed admissions not yet drawn into a settlement.'],
        ['POST /settlements', 'hospital', 'Create a settlement over a stated period, with a summary document.'],
        ['POST /settlements/:id/upload-receipt', 'hospital', 'Upload the payment receipt. Advances the settlement to pending verification.'],
        ['GET /settlements/hospital', 'hospital', 'The hospital\'s settlement history.'],
        ['GET /settlements/admin', 'admin', 'All settlements awaiting administrative action.'],
        ['POST /settlements/admin/:id/verify', 'admin', 'Verify a receipt, or reject it with a reason that returns it to the hospital.'],
        ['POST /settlements/admin/:id/payout', 'admin', 'Record a consultant payout with its receipt.'],
        ['GET /settlements/consultant', 'consultant', 'Settlements carrying a payout to this consultant.'],
        ['POST /settlements/consultant/:id/verify', 'consultant', 'Confirm receipt of a payout. Completes the settlement when all payouts are confirmed.'],
      ],
      [2, 0.9, 3],
    );

    b.h(2, 'Laboratory Settlements');

    b.p('Base path /lab-settlements. The state machine is identical to the hospital cycle.');

    b.table(
      ['Method and path', 'Role', 'Purpose'],
      [
        ['GET /lab-settlements/pending-referrals', 'laboratory', 'Closed referrals not yet settled.'],
        ['POST /lab-settlements', 'laboratory', 'Create a settlement over a stated period.'],
        ['POST /lab-settlements/:id/receipt', 'laboratory', 'Upload the payment receipt.'],
        ['GET /lab-settlements/mine', 'laboratory', 'The laboratory\'s settlement history.'],
        ['GET /lab-settlements/admin', 'admin', 'Settlements awaiting administrative action.'],
        ['POST /lab-settlements/:id/verify', 'admin', 'Verify or reject a receipt.'],
        ['POST /lab-settlements/:id/payout', 'admin', 'Record a consultant payout.'],
        ['GET /lab-settlements/consultant', 'consultant', 'Settlements carrying a payout to this consultant.'],
        ['GET /lab-settlements/consultant/earnings', 'consultant', 'Laboratory commission earnings summary.'],
        ['POST /lab-settlements/:id/consultant-verify', 'consultant', 'Confirm receipt of a payout.'],
      ],
      [2, 0.9, 3],
    );

    b.note(
      'The two settlement routers have different path shapes',
      'Hospital administrative actions are namespaced under /settlements/admin/:id/..., while the ' +
      'laboratory equivalents are flat at /lab-settlements/:id/.... The two state machines are ' +
      'identical; only the paths differ. This is recorded as an inconsistency to be aligned in a ' +
      'future interface version, and is noted here so that it is not mistaken for a behavioural ' +
      'difference.',
    );

    // ---------------------------------------------------------------- 9
    b.h(1, 'Administration Endpoints');

    b.p('Base path /admin. The whole router requires the administrator role.');

    b.h(2, 'Users and Approvals');

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['GET /admin/users', 'All accounts.'],
        ['GET /admin/users/pending', 'The registration approval queue.'],
        ['PATCH /admin/users/:id', 'Change account status — activate, suspend, or set pending.'],
        ['POST /admin/users/:id/change-password', 'Set a new password for a user.'],
        ['DELETE /admin/users/:id', 'Delete an account permanently.'],
        ['GET /admin/admins', 'Administrator accounts.'],
        ['POST /admin/admins', 'Create an administrator account.'],
        ['DELETE /admin/admins/:id', 'Remove an administrator account.'],
      ],
      [2, 4],
    );

    b.h(2, 'Party Registries and Commercial Terms');

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['GET /admin/consultants/:id/profile', 'Full consultant profile.'],
        ['GET /admin/consultants/:id/patients', 'Patients referred by this consultant.'],
        ['PATCH /admin/consultants/:id', 'Amend a consultant profile.'],
        ['POST /admin/consultants/:id/commission', 'Set this consultant\'s commission model, type, and rates.'],
        ['GET /admin/hospitals/:id/patients', 'Patients treated at this hospital.'],
        ['PATCH /admin/hospitals/:id', 'Amend a hospital profile.'],
        ['POST /admin/hospitals/:id/deduction', 'Set the hospital\'s platform charge type and value.'],
        ['GET /admin/hospitals/:id/consultant-overrides', 'Per-consultant terms at this hospital.'],
        ['POST /admin/hospitals/:id/consultant-overrides', 'Set a per-consultant override.'],
        ['GET /admin/hospitals/:id/doctors', 'The hospital\'s doctor register.'],
        ['POST /admin/hospitals/:id/doctors', 'Add a doctor on the hospital\'s behalf.'],
        ['PATCH /admin/hospitals/:id/doctors/:doctorId', 'Amend a doctor record.'],
        ['DELETE /admin/hospitals/:id/doctors/:doctorId', 'Remove a doctor record.'],
      ],
      [2.2, 4],
    );

    b.h(2, 'Platform Configuration and Operations');

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['GET /admin/analytics', 'Platform-wide analytics.'],
        ['GET /admin/scoring', 'The current matching weights.'],
        ['PUT /admin/scoring', 'Set the matching weights. Rejected unless they total exactly 100.'],
        ['GET /admin/settings', 'Platform financial defaults and branding.'],
        ['PUT /admin/settings', 'Update platform settings.'],
        ['GET /admin/departments', 'The department and keyword catalogue.'],
        ['POST /admin/departments', 'Add a department with its symptom keywords.'],
        ['PATCH /admin/departments/:id', 'Amend a department entry.'],
        ['DELETE /admin/departments/:id', 'Remove a department entry.'],
        ['GET /admin/referrals', 'All referrals across the platform.'],
        ['PATCH /admin/referrals/:id', 'Correct any referral, including admission details.'],
        ['PATCH /admin/referrals/:id/override', 'Administrative override of referral routing.'],
        ['DELETE /admin/referrals/:id', 'Delete a referral permanently.'],
        ['GET /admin/beds', 'Bed inventory across all hospitals.'],
        ['PATCH /admin/beds/:hospitalId', 'Correct a hospital\'s bed counts.'],
        ['GET /admin/admissions', 'All admissions.'],
        ['GET /admin/payouts', 'Consultant commission accruals.'],
        ['PATCH /admin/payouts/:payoutId', 'Mark a payout as paid.'],
        ['GET /admin/audit-logs', 'The audit log.'],
        ['GET /admin/audit-logs/export', 'Export the audit log.'],
        ['GET /admin/whatsapp/status', 'Messaging integration status.'],
        ['GET /admin/whatsapp/users', 'Recipients reachable by message.'],
        ['POST /admin/whatsapp/send', 'Send a broadcast message.'],
      ],
      [2.1, 4],
    );

    b.note(
      'The messaging console is built but not routed in the client',
      'The three messaging endpoints are live and callable. The administrative screen that uses them ' +
      'exists in the client codebase but is not linked into the application\'s navigation, so the ' +
      'feature is currently reachable only through the API.',
    );

    // ---------------------------------------------------------------- 10
    b.h(1, 'Profile, Notification, Upload, Export, and Payment Endpoints');

    b.h(2, 'Profile');

    b.p('Base path /profile. Available to any authenticated role.');

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['GET /profile/me', 'The caller\'s own profile, including role-specific detail and branding.'],
        ['PUT /profile/me', 'Update the caller\'s own profile.'],
        ['POST /profile/documents', 'Attach a verification document. Documents already verified by an administrator cannot be replaced.'],
        ['POST /profile/favorites', 'Add or remove a favourited hospital, feeding the preference score.'],
        ['POST /profile/change-password', 'Change the caller\'s own password.'],
      ],
      [1.7, 4],
    );

    b.h(2, 'Notifications');

    b.p('Base path /notifications. Available to any authenticated role.');

    b.table(
      ['Method and path', 'Purpose'],
      [
        ['GET /notifications', 'Recent notifications for the caller.'],
        ['GET /notifications/unread-count', 'The unread counter shown in the interface.'],
        ['PATCH /notifications/:id/read', 'Mark one notification read.'],
        ['PATCH /notifications/read-all', 'Mark all notifications read.'],
      ],
      [1.7, 4],
    );

    b.h(2, 'File Upload');

    b.code(
      [
        'POST /v1/upload',
        'Content-Type: multipart/form-data',
        'field name: file',
        '',
        'Accepted types  jpeg, jpg, png, pdf',
        'Maximum size    5 MB',
        'Validation      both file extension and declared content type',
        '',
        '200 OK',
        '{ "success": true, "url": "https://res.cloudinary.com/..." }',
        '',
        'Files are stored in Cloudinary when configured, otherwise on',
        'the local filesystem and served from /uploads.',
      ].join('\n'),
    );

    b.note(
      'This endpoint does not require authentication',
      'It is the only unauthenticated write endpoint besides the payment gateway callback. Uploads are ' +
      'constrained by type and size, and an uploaded file only becomes meaningful once an authenticated ' +
      'user attaches it to a record — but the endpoint itself is open. Placing it behind authentication ' +
      'is the highest-priority security recommendation in this handover package.',
      'danger',
    );

    b.h(2, 'Document Export');

    b.p('Base path /exports. All endpoints return a generated PDF document.');

    b.table(
      ['Method and path', 'Role', 'Produces'],
      [
        ['GET /exports/consultant/referrals', 'consultant', 'The consultant\'s referral roster.'],
        ['GET /exports/consultant/referrals/:id', 'consultant', 'One referral record, with attachments merged in.'],
        ['GET /exports/consultant/lab-referrals', 'consultant', 'The consultant\'s laboratory referral roster.'],
        ['GET /exports/consultant/lab-referrals/:id', 'consultant', 'One laboratory referral record.'],
        ['GET /exports/hospital/records', 'hospital', 'The hospital\'s referral records.'],
        ['GET /exports/hospital/referrals/:id', 'hospital', 'One referral record.'],
        ['GET /exports/lab/records', 'laboratory', 'The laboratory\'s referral records.'],
        ['GET /exports/lab/referrals/:id', 'laboratory', 'One laboratory referral record.'],
        ['GET /exports/admin/referrals/:id', 'admin', 'Any referral record.'],
        ['GET /exports/admin/consultants/:id', 'admin', 'A consultant profile file.'],
        ['GET /exports/admin/hospitals/:id', 'admin', 'A hospital profile file.'],
        ['GET /exports/admin/lab-referrals/:id', 'admin', 'Any laboratory referral record.'],
        ['GET /exports/admin/laboratories/:id', 'admin', 'A laboratory profile file.'],
      ],
      [2.1, 0.9, 3],
    );

    b.h(2, 'Payments');

    b.table(
      ['Method and path', 'Access', 'Purpose'],
      [
        ['GET /payments/initiate-jazzcash/:admissionId', 'Any authenticated user', 'Build a signed payment request for an admission. No role check is applied.'],
        ['POST /payments/jazzcash-callback', 'Public', 'Receive the gateway result. Secured by cryptographic signature verification rather than by authentication.'],
      ],
      [2.3, 1.2, 3],
    );

    b.p(
      'The signing scheme sorts the request parameters, concatenates the integrity salt with the ' +
      'non-empty values, and produces a keyed hash that the gateway verifies. Callbacks are verified by ' +
      'recomputing the same digest, so an unsigned or tampered callback is rejected. Per-hospital ' +
      'merchant credentials override the platform defaults where present.',
    );

    // ---------------------------------------------------------------- 11
    b.h(1, 'Real-Time Interface');

    b.h(2, 'Connecting');

    b.code(
      [
        'const socket = io(SOCKET_URL, { transports: ["websocket"] });',
        '',
        'socket.on("connect", () => {',
        '  socket.emit("join", { token });        // user:<id> + role:<role>',
        '  socket.emit("join_hospital",   { token });  // facility rooms',
        '  socket.emit("join_consultant", { token });',
        '  socket.emit("join_laboratory", { token });',
        '});',
        '',
        'Each join verifies the token, confirms the role matches, resolves',
        'the facility, and joins the room. A failed join is logged and',
        'ignored; it does not close the connection.',
      ].join('\n'),
    );

    b.h(2, 'Rooms');

    b.table(
      ['Room', 'Members', 'Receives'],
      [
        ['user:<id>', 'One user', 'Personal notifications'],
        ['role:<role>', 'All users of a role', 'Role-wide broadcasts'],
        ['hospital:<id>', 'A hospital owner and its team', 'Inbox, escalation, bed, and clinical note events'],
        ['consultant:<id>', 'One consultant', 'Referral status, escalation, and settlement events'],
        ['lab:<id>', 'A laboratory owner and its team', 'Laboratory referral and report events'],
      ],
      [1.2, 1.6, 2.6],
    );

    b.h(2, 'Events');

    b.table(
      ['Event', 'Raised when', 'Sent to'],
      [
        ['notification', 'Any notification is raised', 'The recipient\'s personal room'],
        ['NEW_REFERRAL', 'A referral is created or escalated into a facility', 'The receiving hospital room'],
        ['STATUS_UPDATE', 'A referral changes status, including on billing', 'The consultant and hospital rooms'],
        ['REFERRAL_ESCALATED', 'A referral passes its deadline and is reassigned', 'The previous hospital and the consultant'],
        ['BED_UPDATE', 'Bed counts change', 'The hospital room'],
        ['NEW_CLINICAL_NOTE', 'A clinical note is added', 'The consultant and hospital rooms'],
        ['NEW_LAB_REFERRAL', 'A laboratory referral is created', 'The receiving laboratory room'],
        ['LAB_STATUS_UPDATE', 'A laboratory referral changes status', 'The consultant and laboratory rooms'],
        ['LAB_REPORT_UPLOADED', 'A report file is uploaded', 'The consultant room'],
      ],
      [1.4, 2.2, 2],
    );

    b.p(
      'The reference client subscribes to all nine events and collapses them into a single cache ' +
      'invalidation after a short delay, so a burst of related events produces one refresh. A client ' +
      'implementing its own handling should adopt a similar approach.',
    );

    // ---------------------------------------------------------------- 12
    b.h(1, 'Data Conventions');

    b.h(2, 'Monetary Values');

    b.note(
      'Every monetary value is a whole number of paisa',
      'One rupee is one hundred paisa. A field carrying PKR 45,000 holds the integer 4500000. Field ' +
      'names carrying money end in Paisa. Never send a decimal, a formatted string, or a rupee value ' +
      'to a paisa field — the conversion boundary is the client, and the API accepts integers only.',
      'warn',
    );

    b.h(2, 'Enumerated Values');

    b.table(
      ['Field', 'Permitted values'],
      [
        ['User role', 'consultant, hospital, laboratory, admin'],
        ['Account status', 'pending, active, suspended'],
        ['Referral urgency', 'emergency, urgent, routine'],
        ['Referral status', 'pending, accepted, rejected, admitted, closed'],
        ['Laboratory referral status', 'pending, accepted, reported, closed, rejected'],
        ['Admission status', 'active, discharged, billed'],
        ['Settlement status', 'pending_payment, pending_admin_verification, paid_pending_consultant_payout, paid_pending_consultant_verification, completed'],
        ['Payment method', 'pending, cash, jazzcash, easypaisa, bank_transfer, manual'],
        ['Ward type', 'General, Private, ICU, NICU, PICU, HDU, Burns, Maternity, Psychiatric, Cardiac'],
        ['Gender', 'male, female, other'],
        ['Guardian relation', 'S/O, D/O, W/O'],
        ['Clinical note type', 'nursing, consultant'],
        ['Commission model', 'legacy, additive'],
        ['Commission and charge type', 'percentage, fixed'],
        ['Payout status', 'accrued, paid, pending_withdrawal'],
      ],
      [1.3, 4],
    );

    b.h(2, 'Identifiers and Formats');

    b.table(
      ['Item', 'Format'],
      [
        ['Record identifiers', '24-character hexadecimal database identifiers.'],
        ['Referral code', 'CB-YYYY-NNNN, allocated atomically and sequentially within the year.'],
        ['Laboratory referral code', 'LAB-YYYY-NNNN, allocated from a separate sequence.'],
        ['Dates and times', 'ISO 8601. Times in message templates are rendered in Pakistan Standard Time.'],
        ['National identity number', 'Five digits, hyphen, seven digits, hyphen, one digit. Encrypted before storage on referral records.'],
        ['Telephone number', 'Validated against Pakistani mobile and landline formats.'],
        ['Geographic coordinates', 'A two-element array ordered longitude then latitude, following the geospatial standard.'],
      ],
      [1.4, 4],
    );

    b.note(
      'Coordinate order',
      'Geographic points are stored longitude first, then latitude — the order required by the ' +
      'geospatial standard, and the reverse of how coordinates are usually spoken. Reversing them ' +
      'places a hospital in the wrong hemisphere and silently corrupts every distance calculation for ' +
      'that record.',
      'warn',
    );
  },
};
