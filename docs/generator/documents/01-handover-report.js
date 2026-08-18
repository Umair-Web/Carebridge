const { meta } = require('../common');

module.exports = {
  meta: meta(
    'CB-PHR-2026-001',
    'Project Handover & Completion Report',
    'Delivered scope, acceptance status, and formal transfer of the CareBridge healthcare referral and settlement platform',
  ),

  body(b) {
    // ---------------------------------------------------------------- 1
    b.h(1, 'Executive Summary');

    b.p(
      'CareBridge is a healthcare referral and settlement platform that connects referring consultants ' +
      'with hospitals and diagnostic laboratories, and manages the commercial relationship between them ' +
      'end to end. This report closes the development engagement: it states what was built, confirms ' +
      'the current status of each delivered module, records what remains outside the delivered scope, ' +
      'and sets out the terms on which the system is transferred to the client.',
    );

    b.p(
      'The platform is complete and deployed. It comprises a React single-page application served from ' +
      'Vercel and a Node.js REST and real-time API served from Railway, backed by MongoDB. Four user ' +
      'roles are supported — consultant, hospital, laboratory, and platform administrator — each with ' +
      'its own portal, permissions, and workflows. The commercial engine that splits patient bills ' +
      'between the facility, the referring consultant, and the platform is implemented as a single ' +
      'tested module and covers both the original nested commission model and the additive per-doctor ' +
      'model adopted later in the engagement.',
    );

    b.h(2, 'Delivery at a Glance');

    b.table(
      ['Measure', 'Value'],
      [
        ['Delivered modules', '9 functional modules across 4 user roles'],
        ['REST API endpoints', '130+ endpoints across 14 routers, all versioned under /v1'],
        ['Data model', '17 MongoDB collections'],
        ['Application screens', '48 routed screens'],
        ['Source code', 'Approximately 31,400 lines of application code (excluding dependencies)'],
        ['Automated tests', '40 tests across 5 suites — all passing'],
        ['Development period', '3 May 2026 to 8 July 2026'],
        ['Deployment', 'Live — frontend on Vercel, backend and scheduler on Railway, database on MongoDB'],
      ],
      [1.3, 3],
    );

    b.h(2, 'Statement of Completion');

    b.p(
      'All modules described in Section 3 of this report are implemented, deployed, and operational. ' +
      'The automated test suite passes in full. Requirements raised after the final code change of ' +
      'this engagement are not part of this delivery and are recorded in Section 6 as outstanding ' +
      'scope for a subsequent phase.',
    );

    b.note(
      'Read this section alongside Section 6',
      'This report certifies the delivered scope as complete. It does not certify that every requirement ' +
      'ever discussed during the engagement has been built. Section 6 records the scope that remains ' +
      'outstanding, including requirements raised after the final code change. Please review Section 6 ' +
      'before signing the acceptance block in Section 8.',
      'warn',
    );

    // ---------------------------------------------------------------- 2
    b.h(1, 'Project Overview');

    b.h(2, 'Purpose of the System');

    b.p(
      'Patient referral in the private healthcare sector is typically informal — a consultant telephones ' +
      'a hospital, the patient is sent, and the commercial arrangement between the parties is settled ' +
      'privately and inconsistently. CareBridge formalises this into a tracked, auditable process. A ' +
      'consultant creates a structured referral; the platform recommends suitable hospitals based on ' +
      'clinical fit, bed availability, distance, and past performance; the hospital responds within a ' +
      'deadline; the patient is admitted, treated, and billed; and the resulting money is split between ' +
      'the parties according to terms held in the system rather than in individual memory.',
    );

    b.h(2, 'Business Objectives Addressed');

    b.table(
      ['Objective', 'How the delivered system addresses it'],
      [
        ['Route referrals to the right facility',
          'A weighted scoring engine ranks hospitals against each referral on six configurable factors, hard-filtering any hospital that lacks the required department or a free bed in the required ward.'],
        ['Guarantee a response to the referring doctor',
          'Every referral carries a response deadline set by clinical urgency. A scheduler checks every minute and automatically escalates unanswered referrals to the next hospital in the ranked list, or — for emergencies — to the nearest alternative within 20 km.'],
        ['Make the commercial split explicit and consistent',
          'A single commission engine computes every bill split. Terms are held per platform, per facility, and per consultant-facility pairing, and the terms applied are snapshotted onto each payout record so historical calculations remain reproducible after rates change.'],
        ['Provide an auditable settlement cycle',
          'Hospitals and laboratories bundle billed cases into periodic settlements, pay the platform, and upload receipts. Administrators verify each receipt before consultant payouts are released, and consultants confirm receipt to close the cycle.'],
        ['Protect patient information',
          'Patient national identity numbers are encrypted at the field level before storage. Access to every screen and endpoint is controlled by role, and administrative actions are recorded in an audit log.'],
        ['Give the platform operator control',
          'Administrators configure commercial terms, matching-engine weights, the department catalogue, and platform branding from the admin console, without code changes or redeployment.'],
      ],
      [1.4, 3.4],
    );

    b.h(2, 'Users of the System');

    b.table(
      ['Role', 'Description', 'Primary responsibility'],
      [
        ['Consultant', 'Referring doctors in private practice or clinics', 'Create and track referrals; receive commission'],
        ['Hospital', 'Hospital administrators and their staff accounts', 'Accept referrals, admit and bill patients, settle with the platform'],
        ['Laboratory', 'Diagnostic laboratory administrators and staff', 'Accept test referrals, report results, bill and settle'],
        ['Administrator', 'CareBridge platform operations staff', 'Approve registrations, set commercial terms, verify settlements, oversee the platform'],
      ],
      [1, 2.2, 2.6],
    );

    // ---------------------------------------------------------------- 3
    b.h(1, 'Delivered Scope');

    b.p(
      'The following modules constitute the delivered system. Every item marked Implemented is present ' +
      'in the deployed codebase and operational.',
    );

    b.h(2, 'Module 1 — Identity, Registration, and Access Control');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Self-service registration for consultants, hospitals, and laboratories, each with role-specific fields'],
        ['Implemented', 'Mandatory upload of verification documents (professional registration certificates and identity documents) at registration'],
        ['Implemented', 'Mandatory acceptance of the standard operating procedure and privacy policy before submission'],
        ['Implemented', 'Six-digit email one-time-password verification, with resend and cooldown'],
        ['Implemented', 'Administrator approval gate — accounts are created pending and cannot sign in until reviewed and activated'],
        ['Implemented', 'Rejection of an application with a stated reason, communicated to the applicant'],
        ['Implemented', 'Password reset by emailed single-use time-limited link; administrator-initiated password reset'],
        ['Implemented', 'Session management using a short-lived access token with rolling refresh, refreshed transparently in the browser'],
        ['Implemented', 'Role-based route and endpoint authorisation across all four roles'],
        ['Implemented', 'Sub-account creation so hospitals, laboratories, and the platform can add team members with their own logins'],
        ['Implemented', 'Account suspension and reactivation without loss of history'],
      ],
      [0.85, 4],
    );

    b.h(2, 'Module 2 — Referral Creation and Intelligent Matching');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Four-step guided referral intake covering patient demographics, clinical assessment, preferences, and hospital selection'],
        ['Implemented', 'Age entry in years, months, or days with automatic derivation of date of birth, supporting paediatric and neonatal referrals'],
        ['Implemented', 'Field-level encryption of the patient national identity number'],
        ['Implemented', 'Automatic department suggestion from free-text symptoms using an administrator-maintained keyword catalogue'],
        ['Implemented', 'Clinical urgency classification (emergency, urgent, routine) driving the hospital response deadline'],
        ['Implemented', 'Attachment upload for prior reports, scans, and images'],
        ['Implemented', 'Weighted hospital scoring on six factors: department match, bed availability, distance, cost fit, response-time history, and consultant preference'],
        ['Implemented', 'Hard filtering of hospitals lacking the required department or a free bed in the required ward'],
        ['Implemented', 'Selection of a specific department and named doctor at the receiving hospital'],
        ['Implemented', 'Submission to multiple hospitals as independently tracked referrals'],
        ['Implemented', 'Consultant favourites and automatic learning from referral history, both feeding the preference factor'],
        ['Implemented', 'Unique sequential referral codes allocated atomically'],
      ],
      [0.85, 4],
    );

    b.h(2, 'Module 3 — Referral Lifecycle and Escalation');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Hospital inbox with live per-referral countdown to the response deadline'],
        ['Implemented', 'Dedicated emergency triage board filtered to unanswered emergency referrals'],
        ['Implemented', 'Accept with mandatory department assignment; reject with mandatory reason'],
        ['Implemented', 'Response deadlines by urgency — 15 minutes for emergencies, 2 hours for urgent, 24 hours for routine'],
        ['Implemented', 'Automatic escalation every minute of any referral past its deadline to the next ranked hospital, with a fresh deadline'],
        ['Implemented', 'Geographic fallback for emergencies — escalation to the nearest active alternative hospital within 20 km when the ranked list is exhausted'],
        ['Implemented', 'Automatic rejection with an explanatory reason when no hospital remains'],
        ['Implemented', 'Performance penalty applied to a hospital that allows a referral to escalate, feeding back into its future ranking'],
        ['Implemented', 'Shared clinical notes timeline, distinguishing nursing and consultant entries, visible to the referring consultant'],
        ['Implemented', 'Full referral status lifecycle: pending, accepted, rejected, admitted, closed'],
      ],
      [0.85, 4],
    );

    b.h(2, 'Module 4 — Admissions, Beds, and Hospital Operations');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Admission of an accepted referral with ward, room, bed, department, and treating doctor'],
        ['Implemented', 'Line-item billing on discharge with automatic totalling, payment method, reference, and attached patient bill'],
        ['Implemented', 'Bed inventory across ten ward types with quick adjustment and direct editing'],
        ['Implemented', 'Department management determining which referrals the hospital is eligible to receive'],
        ['Implemented', 'Hospital doctor register with specialty, registration number, consultation fee, and availability toggle'],
        ['Implemented', 'Financial ledger of billed amounts, platform charges, and net position, exportable to CSV'],
        ['Implemented', 'Hospital-level portal branding — logo and primary colour applied for that hospital\'s users'],
        ['Implemented', 'Hospital team management with creation-hierarchy protection'],
      ],
      [0.85, 4],
    );

    b.h(2, 'Module 5 — Laboratory Module');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Laboratory registration including an initial test catalogue with prices and turnaround times'],
        ['Implemented', 'Laboratory referral creation by consultants, with an ordered test list and an optional patient discount capped per consultant'],
        ['Implemented', 'Laboratory suggestion and direct selection by name'],
        ['Implemented', 'Acceptance requiring a committed expected report date and time'],
        ['Implemented', 'Report file upload with immediate notification to the consultant'],
        ['Implemented', 'Per-test billing pre-filled from the laboratory\'s catalogue, with test descriptions locked to the consultant\'s order'],
        ['Implemented', 'Re-referral of a rejected case to an alternative laboratory without re-entry of patient details'],
        ['Implemented', 'Independent laboratory settlement cycle mirroring the hospital cycle'],
        ['Implemented', 'Laboratory test catalogue maintenance and team management'],
      ],
      [0.85, 4],
    );

    b.h(2, 'Module 6 — Commission and Settlement Engine');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Single commission engine used by every calculation path, eliminating the duplicated bill-splitting logic identified during design'],
        ['Implemented', 'Nested (legacy) commission model — platform takes a percentage of the bill, the consultant takes a percentage of that'],
        ['Implemented', 'Additive (per-doctor) commission model — consultant fee and platform charge computed independently and summed'],
        ['Implemented', 'Percentage or fixed amount, selectable independently for the consultant fee and the platform charge'],
        ['Implemented', 'Per-referral fixed charges for hospitals and per-test fixed charges for laboratories'],
        ['Implemented', 'Three-tier terms resolution: consultant-facility override, then facility terms, then platform defaults'],
        ['Implemented', 'Snapshotting of the terms applied onto every payout record, so historical figures remain reproducible after rates change'],
        ['Implemented', 'Mixed settlements — a single settlement period may contain consultants on different models, types, and rates'],
        ['Implemented', 'Five-stage settlement state machine for both hospitals and laboratories, from pending payment through to completed'],
        ['Implemented', 'Receipt upload by the facility, verification or rejection with reason by the administrator, payout release, and consultant confirmation of receipt'],
        ['Implemented', 'Consultant earnings dashboard, withdrawal request with a minimum threshold, and exportable earnings statement'],
        ['Implemented', 'All monetary values stored as integer paisa, avoiding floating-point rounding error'],
      ],
      [0.85, 4],
    );

    b.h(2, 'Module 7 — Platform Administration');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Registration approval queue with document review'],
        ['Implemented', 'Consultant, hospital, and laboratory registries with profile editing, status control, forced password reset, and export'],
        ['Implemented', 'Commercial terms configuration at platform, facility, and consultant-facility level'],
        ['Implemented', 'Matching-engine weight configuration with enforced validation that weights total exactly 100'],
        ['Implemented', 'Department and symptom-keyword catalogue maintenance'],
        ['Implemented', 'Platform-wide referral oversight, including correction of any referral and a three-stage confirmed deletion'],
        ['Implemented', 'Cross-hospital bed inventory oversight and correction'],
        ['Implemented', 'Settlement verification and payout release for both hospitals and laboratories'],
        ['Implemented', 'Financial defaults configuration, including wallet threshold and initial hold'],
        ['Implemented', 'Platform white-labelling — name, logo, favicon, and colour scheme'],
        ['Implemented', 'Searchable and exportable audit log of administrative actions'],
        ['Implemented', 'Administrator team management'],
      ],
      [0.85, 4],
    );

    b.h(2, 'Module 8 — Notifications and Real-Time Updates');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Eighteen notification event types spanning registration, referral, admission, billing, settlement, and account events'],
        ['Implemented', 'In-application notification centre with unread counter and live delivery'],
        ['Implemented', 'Email notification channel'],
        ['Implemented', 'Live screen updates over a persistent connection — dashboards, inboxes, and bed counts refresh without user action'],
        ['Implemented', 'Notification fan-out to facility owners and all their team members'],
        ['Implemented', 'Removal of personal data from stored notification payloads'],
        ['Partial', 'WhatsApp notification channel — the integration is implemented and documented, but requires the client to complete Meta Business template approval before live messages are delivered. See the Deployment and Operations Guide.'],
      ],
      [0.85, 4],
    );

    b.h(2, 'Module 9 — Documents, Exports, and Payments');

    b.table(
      ['Status', 'Capability'],
      [
        ['Implemented', 'Server-generated PDF records for referrals, consultant rosters, hospital records, laboratory records, and profile files, with attachments merged into the output'],
        ['Implemented', 'Consultant earnings statement and laboratory earnings export generated in the browser'],
        ['Implemented', 'Hospital financial ledger export to CSV'],
        ['Implemented', 'Audit log export'],
        ['Implemented', 'Document upload to cloud storage with type and size validation'],
        ['Partial', 'JazzCash online payment — the integration including request signing and callback verification is implemented, but the platform currently operates on the manual receipt-based settlement cycle. Activation requires live merchant credentials from the client. See the Deployment and Operations Guide.'],
      ],
      [0.85, 4],
    );

    // ---------------------------------------------------------------- 4
    b.h(1, 'Technical Delivery');

    b.h(2, 'Technology Stack');

    b.table(
      ['Layer', 'Technology', 'Rationale'],
      [
        ['Frontend', 'React 19, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query 5',
          'Component model suited to role-specific portals; server-state caching reduces redundant requests; utility styling supports runtime white-labelling.'],
        ['Backend', 'Node.js 20+, Express 5',
          'Single language across the stack; mature ecosystem for the required integrations.'],
        ['Database', 'MongoDB with Mongoose 9',
          'Document model fits the varying shape of referral, admission, and settlement records; native geospatial indexing supports distance-based matching and emergency fallback.'],
        ['Real-time', 'Socket.IO 4',
          'Push updates to inboxes and dashboards; room-based addressing targets individual users, roles, and facilities.'],
        ['Scheduling', 'node-cron',
          'Runs the per-minute referral escalation check in the API process.'],
        ['File storage', 'Cloudinary',
          'Offloads document and report storage from the application server.'],
        ['Email', 'Resend',
          'Transactional delivery for verification codes, password resets, and notifications.'],
        ['Messaging', 'Meta WhatsApp Cloud API',
          'Notification channel appropriate to the user base.'],
        ['Payments', 'JazzCash',
          'Local payment gateway integration.'],
        ['Hosting', 'Vercel (frontend), Railway (backend)',
          'Managed platforms with automatic deployment from the repository.'],
      ],
      [0.9, 1.5, 3],
    );

    b.h(2, 'Architecture');

    b.diagram(
      'Deployed system architecture',
      String.raw`
   +-------------------------------------------------------------+
   |                        USERS (browser)                      |
   |   Consultant  |  Hospital  |  Laboratory  |  Administrator  |
   +-------------------------------------------------------------+
                    |  HTTPS            |  WebSocket
                    v                   v
   +-------------------------------------------------------------+
   |     VERCEL  —  React single-page application (static)       |
   +-------------------------------------------------------------+
                    |  REST /v1            |  Socket.IO
                    v                      v
   +-------------------------------------------------------------+
   |     RAILWAY  —  Express API  +  Socket.IO  +  scheduler     |
   |   routes -> controllers -> services -> models               |
   |   commission engine | scoring engine | notifications        |
   +-------------------------------------------------------------+
        |              |              |              |
        v              v              v              v
   +----------+  +-----------+  +----------+  +--------------+
   | MongoDB  |  |Cloudinary |  |  Resend  |  |JazzCash / WA |
   | database |  |  files    |  |  email   |  | integrations |
   +----------+  +-----------+  +----------+  +--------------+
`,
    );

    b.h(2, 'Deployment Position');

    b.table(
      ['Component', 'Platform', 'Deployment method'],
      [
        ['Frontend application', 'Vercel', 'Built with Vite and served as static assets, with single-page routing rewrites and security response headers configured.'],
        ['Backend API and scheduler', 'Railway', 'Run directly from source with automatic restart on failure.'],
        ['Database', 'MongoDB', 'Managed instance reached over an authenticated connection string.'],
        ['File storage', 'Cloudinary', 'Managed service, credentials held in backend configuration.'],
      ],
      [1.2, 0.9, 3],
    );

    // ---------------------------------------------------------------- 5
    b.h(1, 'Quality Assurance');

    b.h(2, 'Automated Test Results');

    b.p(
      'The automated suite runs against the backend business logic. It was executed in full at the time ' +
      'of this report with the following result.',
    );

    b.table(
      ['Suite', 'Tests', 'Result', 'Coverage'],
      [
        ['Commission engine', '17', 'Pass', 'Both commission models, percentage and fixed types for hospitals and laboratories, facility and consultant overrides, the invariant that the total deduction equals the consultant fee plus the platform charge, zero-bill handling, and the case where a fixed charge exceeds a small bill.'],
        ['Scoring engine', '6', 'Pass', 'Score composition on a full match, rejection when the department is absent or no bed is free, emergency intensive-care requirement, the 100-point cap, and distance calculation.'],
        ['PDF export service', '12', 'Pass', 'Validity of all eight document builders, single-page output for short records, image attachments embedded as pages, and PDF attachments merged page for page.'],
        ['Field encryption', '4', 'Pass', 'Encryption and decryption round trip, distinct output for repeated encryption of the same value, and safe handling of empty and unencrypted values.'],
        ['Account hierarchy', '1', 'Pass', 'Creation-chain ancestry check used to authorise team member deletion.'],
        ['Total', '40', 'Pass', 'All suites passing, no failures, no skipped tests.'],
      ],
      [1.2, 0.5, 0.6, 4],
    );

    b.note(
      'What the automated suite does and does not cover',
      'The suite covers the calculation-heavy logic where a defect would be financially material and ' +
      'hardest to detect by inspection — bill splitting, hospital scoring, encryption, and document ' +
      'generation. It does not include HTTP-level integration tests of the controllers and routes, the ' +
      'escalation scheduler, or the settlement state machines; those areas were validated by manual ' +
      'testing. This is recorded as a recommendation in the Test Plan and QA Report.',
    );

    b.h(2, 'Manual Verification');

    b.p(
      'Each role\'s end-to-end workflow was exercised manually against the deployed environment: ' +
      'registration through to approval and first sign-in; referral creation through hospital ' +
      'acceptance, admission, billing, and closure; laboratory referral through reporting and billing; ' +
      'and a full settlement cycle through to consultant confirmation of receipt. Detail is recorded in ' +
      'the Test Plan and QA Report.',
    );

    // ---------------------------------------------------------------- 6
    b.h(1, 'Outstanding Scope and Known Limitations');

    b.p(
      'This section is a complete and deliberate record of what the delivered system does not do. It ' +
      'exists so that the client can make an informed acceptance decision and plan any subsequent phase ' +
      'accurately.',
    );

    b.h(2, 'Client Requirements Not Included in This Delivery');

    b.p(
      'Requirements received after the final code change of this engagement are outside the scope of ' +
      'this delivery and are tracked separately. They are not implemented in the delivered system and ' +
      'should be scoped and quoted as a subsequent phase.',
    );

    b.note(
      'New scope, not defects',
      'Scope raised after the close of the engagement is not a defect in what was delivered. Where such ' +
      'requirements affect the data model, the API authorisation layer, or the user interface, they ' +
      'should be estimated as new work rather than treated as remedial.',
      'warn',
    );

    b.h(2, 'Technical Limitations of the Delivered System');

    b.p(
      'The following are characteristics of the system as delivered that the client should be aware of. ' +
      'Each is described with its practical consequence. Recommended remediation is given in the ' +
      'Security and Compliance document and the Maintenance and Support Guide.',
    );

    b.table(
      ['Limitation', 'Practical consequence'],
      [
        ['Administrator role bypasses role checks',
          'The authorisation layer grants administrators access to every endpoint regardless of the role stated for that endpoint. This is intentional for platform oversight, but it means an administrator account is unrestricted and should be issued sparingly and protected accordingly.'],
        ['The file upload endpoint does not require authentication',
          'Files can be uploaded without signing in. Uploads are constrained to images and PDF documents of 5 MB or less, and an uploaded file is only meaningful once attached to a record by an authenticated user, but the endpoint should be placed behind authentication. This is the highest-priority item in the recommendations.'],
        ['One-time passwords are held in application memory',
          'Verification codes do not survive a restart of the backend, and the backend cannot be scaled to more than one instance without codes failing intermittently. Moving this store to a shared cache is required before horizontal scaling.'],
        ['Rate limiting applies only to authentication endpoints',
          'Registration, sign-in, and password reset are throttled. The remainder of the API is not, leaving it without protection against automated abuse.'],
        ['Patient identity encryption is unauthenticated',
          'The encryption in use provides confidentiality but not tamper detection — modification of stored ciphertext would not be detected on decryption. Upgrading to an authenticated encryption mode is recommended.'],
        ['Cross-origin policy defaults to permissive when unset',
          'If the allowed-origins setting is left blank, the API accepts requests from any origin. It must be set explicitly in the production environment.'],
        ['A superseded wallet crediting path remains in the codebase',
          'An earlier automatic wallet-crediting module remains present but is not connected to the current settlement flow. It duplicates commission arithmetic outside the tested engine and should be removed to prevent future accidental use.'],
        ['No integration or end-to-end automated tests',
          'Controllers, routes, the escalation scheduler, and the settlement state machines are covered by manual testing only, so regressions in those areas will not be caught automatically.'],
        ['Two built screens are not reachable',
          'A WhatsApp broadcast console and a public landing page exist in the codebase but are not linked into the application. They can be enabled with a small change if wanted.'],
      ],
      [1.4, 3.4],
    );

    b.h(2, 'Client Actions Required to Activate Optional Features');

    b.table(
      ['Feature', 'Action required by the client'],
      [
        ['WhatsApp notifications', 'Complete Meta Business verification and obtain approval for the two message templates, then supply the resulting credentials for configuration. The setup runbook is included in the handover package.'],
        ['JazzCash online payments', 'Supply live merchant credentials. The platform currently operates the manual receipt-based settlement cycle, which is fully functional without this.'],
        ['Custom email sending domain', 'Verify the sending domain with the email provider so notifications are sent from a CareBridge address rather than the provider default.'],
      ],
      [1.1, 3.4],
    );

    // ---------------------------------------------------------------- 7
    b.h(1, 'Handover Package');

    b.h(2, 'Documentation Delivered');

    b.table(
      ['Reference', 'Document', 'Purpose'],
      [
        ['CB-PHR-2026-001', 'Project Handover & Completion Report', 'This document — delivered scope, status, and formal transfer.'],
        ['CB-SRS-2026-002', 'Software Requirements Specification', 'Functional and non-functional requirements, each traced to its implementation status.'],
        ['CB-SAD-2026-003', 'System Architecture & Design Document', 'Architecture, module design, data model, and the commission and scoring algorithms.'],
        ['CB-API-2026-004', 'API Reference', 'Complete endpoint catalogue, authentication model, error handling, and real-time events.'],
        ['CB-DOG-2026-005', 'Deployment & Operations Guide', 'Deployment procedures, configuration reference, backup and restore, and operational runbooks.'],
        ['CB-QA-2026-006', 'Test Plan & QA Report', 'Test strategy, automated results, acceptance scenarios by role, and defect position.'],
        ['CB-UM-2026-007', 'User Manual', 'Operating instructions for all four roles.'],
        ['CB-SEC-2026-008', 'Security & Compliance Document', 'Security architecture, access control matrix, data protection, and assessment of the delivered security model.'],
        ['CB-MSG-2026-009', 'Maintenance & Support Guide', 'Codebase orientation, routine maintenance, troubleshooting, and the recommended roadmap.'],
      ],
      [1.1, 1.8, 3],
    );

    b.h(2, 'Assets Transferred');

    b.bullets([
      'Source code — the complete repository including frontend, backend, tests, and the documentation generation scripts used to produce this package.',
      'Configuration templates — a documented environment file listing every setting the system reads, with guidance on each.',
      'Operational scripts — administrator seeding, data maintenance, and verification utilities.',
      'Design records — the internal design documents tracing the evolution of the commission model through its three generations, and the WhatsApp production setup runbook.',
      'Deployment configuration — the hosting configuration files for both platforms, committed to the repository.',
    ]);

    b.h(2, 'Credentials and Accounts');

    b.note(
      'Credentials are transferred separately',
      'Access credentials for the hosting platforms, the database, and the third-party services are not ' +
      'contained in this document or any other document in this package. They are transferred by a ' +
      'separate secure channel. On receipt, the client should rotate every shared secret — in ' +
      'particular the authentication signing keys and the database password — so that the delivered ' +
      'system operates on secrets known only to the client. The procedure is set out in the Deployment ' +
      'and Operations Guide.',
      'warn',
    );

    // ---------------------------------------------------------------- 8
    b.h(1, 'Acceptance and Sign-Off');

    b.h(2, 'Basis of Acceptance');

    b.p(
      'By signing below, the client acknowledges that the modules listed in Section 3 have been ' +
      'delivered and demonstrated; that the outstanding scope and technical limitations recorded in ' +
      'Section 6 have been read and understood, including requirements raised after the close of the ' +
      'engagement that are not implemented; and that the documentation and assets listed in Section 7 ' +
      'have been received.',
    );

    b.h(2, 'Recommended Immediate Actions');

    b.p(
      'The following should be completed by the client within the first week of taking ownership. Each ' +
      'is explained in the Deployment and Operations Guide.',
    );

    b.bullets([
      'Rotate all shared secrets — the two authentication signing keys, the database password, and every third-party service key.',
      'Set the allowed-origins configuration explicitly to the production frontend address, so the API is not open to arbitrary origins.',
      'Place the file upload endpoint behind authentication — the single highest-priority security action.',
      'Confirm that automated database backups are enabled and verify a restore into a test environment.',
      'Change the seeded administrator password and create named administrator accounts for each operator, so that audit log entries identify individuals.',
      'Review the outstanding scope in Section 6 and decide which items to commission as a subsequent phase.',
    ], { ordered: true });

    b.h(2, 'Signatures');

    b.p(
      'This report is issued in the version and on the date shown on the cover page.',
    );

    b.signatures([
      { role: 'For the Client\n(CareBridge Health)' },
      { role: 'For the Development Team' },
    ]);
  },
};
