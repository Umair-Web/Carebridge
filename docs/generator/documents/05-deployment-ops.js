const { meta } = require('../common');

module.exports = {
  meta: meta(
    'CB-DOG-2026-005',
    'Deployment & Operations Guide',
    'Deployment procedures, configuration reference, third-party services, backup and recovery, and operational runbooks',
  ),

  body(b) {
    // ---------------------------------------------------------------- 1
    b.h(1, 'Introduction');

    b.h(2, 'Purpose and Audience');

    b.p(
      'This guide is for whoever operates CareBridge in production. It covers deploying the system, ' +
      'configuring it, the third-party accounts it depends on, how to back it up and restore it, and ' +
      'what to do when something goes wrong. It assumes familiarity with web application hosting but ' +
      'no prior knowledge of this system.',
    );

    b.h(2, 'Deployment Topology');

    b.diagram(
      'Production topology',
      String.raw`
   Users (browser)
        |
        |  HTTPS
        v
   +----------------------+        +---------------------------+
   |  VERCEL              |        |  RAILWAY                  |
   |  Frontend            | -----> |  Backend API              |
   |  static build        | REST   |  + Socket.IO server       |
   |  SPA rewrites        | + WS   |  + escalation scheduler   |
   |  security headers    |        |  single instance          |
   +----------------------+        +---------------------------+
                                        |      |      |     |
                          +-------------+      |      |     +-------------+
                          v                    v      v                   v
                   +-------------+   +-------------+  +-----------+  +----------+
                   |  MongoDB    |   | Cloudinary  |  |  Resend   |  | JazzCash |
                   |  database   |   | file store  |  |  email    |  | Meta WA  |
                   +-------------+   +-------------+  +-----------+  +----------+
                    REQUIRED          REQUIRED         REQUIRED       OPTIONAL
`,
    );

    b.note(
      'The backend must run as a single instance',
      'Two components hold state in process memory: the one-time-password store used for email ' +
      'verification, and the referral escalation scheduler. Running a second instance would cause ' +
      'verification codes to fail intermittently and could escalate a referral twice. Do not increase ' +
      'the replica count without first addressing both, as described in section 8.',
      'danger',
    );

    b.h(2, 'Repository Layout');

    b.code(
      [
        'CareBridge/',
        '  backend/            Express API, Socket.IO, scheduler',
        '    src/',
        '      server.js       application entry point',
        '      routes/         14 routers, mounted under /v1',
        '      controllers/    request handlers',
        '      services/       business logic (commission, billing, scoring...)',
        '      models/         17 Mongoose schemas',
        '      middleware/     authentication, authorisation, file upload',
        '      jobs/           referral escalation scheduler',
        '      utils/          encryption, email, scoring, deadlines',
        '      scripts/        seeding and maintenance utilities',
        '      bootstrap/      one-time platform data seeding at startup',
        '    tests/            automated test suites',
        '    docs/             design records and integration runbooks',
        '    .env.example      configuration template',
        '    railway.json      backend hosting configuration',
        '',
        '  frontend/           React single-page application',
        '    src/',
        '      App.jsx         route table and role guards',
        '      pages/          screens, grouped by role',
        '      components/     shared components',
        '      context/        auth, socket, notifications, branding',
        '      features/       auth context',
        '      hooks/          shared data hooks',
        '      utils/          API client, formatting, exports',
        '      config.js       backend addresses',
        '    vercel.json       frontend hosting configuration',
        '',
        '  docs/generator/     documentation source and build script',
        '  docs/output/        generated PDF documentation',
      ].join('\n'),
    );

    // ---------------------------------------------------------------- 2
    b.h(1, 'Prerequisites');

    b.h(2, 'Required Accounts');

    b.table(
      ['Service', 'Purpose', 'Necessity'],
      [
        ['MongoDB', 'The application database. A managed cluster is recommended; geospatial indexing must be available.', 'Required — the application will not start without it.'],
        ['Railway', 'Hosts the backend API, socket server, and scheduler.', 'Required, or an equivalent Node.js host.'],
        ['Vercel', 'Hosts the frontend build.', 'Required, or an equivalent static host.'],
        ['Cloudinary', 'Stores verification documents, report files, and receipts.', 'Required in production. Without it, files are written to the application filesystem, which does not survive a redeployment.'],
        ['Resend', 'Sends verification codes, password resets, and notification email.', 'Required. Registration cannot complete without email delivery.'],
        ['Meta Business (WhatsApp)', 'Message notification channel.', 'Optional. The platform operates fully without it.'],
        ['JazzCash', 'Online payment gateway.', 'Optional. The platform operates on the manual settlement cycle without it.'],
      ],
      [1.1, 2.6, 2.4],
    );

    b.h(2, 'Local Development Requirements');

    b.bullets([
      'Node.js version 20 or later, and npm.',
      'Access to a MongoDB instance — a local server or a development cluster.',
      'A code editor and a Git client.',
    ]);

    // ---------------------------------------------------------------- 3
    b.h(1, 'Configuration Reference');

    b.h(2, 'How Configuration Is Supplied');

    b.p(
      'All configuration is supplied through environment variables. No secret is committed to the ' +
      'repository. The backend repository contains a template file listing the core settings with ' +
      'guidance; copy it to a working configuration file locally, and set the same values as ' +
      'environment variables on the hosting platform in production.',
    );

    b.h(2, 'Core Settings');

    b.table(
      ['Variable', 'Required', 'Description'],
      [
        ['NODE_ENV', 'Yes', 'Set to production in production. This is not cosmetic: in production the application refuses to start without an encryption key, whereas in development it warns and stores plaintext.'],
        ['PORT', 'No', 'Listening port. Defaults to 5000. The hosting platform normally supplies this.'],
        ['BACKEND_URL', 'Yes', 'The public address of the backend. Used to construct links in email and to serve locally stored files.'],
        ['FRONTEND_URL', 'Yes', 'The public address of the frontend. Used to construct verification and password-reset links in email. If this is wrong, users receive links that do not work.'],
        ['MONGO_URI', 'Yes', 'The database connection string, including credentials.'],
        ['CORS_ORIGINS', 'Yes in production', 'Comma-separated list of origins permitted to call the API. If left blank the API accepts requests from any origin.'],
      ],
      [1.2, 0.7, 3.4],
    );

    b.note(
      'CORS_ORIGINS must be set explicitly in production',
      'Blank means permissive. Set it to the exact frontend address — for example ' +
      'https://app.carebridge.com — with no trailing slash. This is one of the six actions listed in ' +
      'the go-live checklist.',
      'warn',
    );

    b.h(2, 'Security Settings');

    b.table(
      ['Variable', 'Required', 'Description'],
      [
        ['JWT_SECRET', 'Yes', 'Signing key for access tokens. A long random string.'],
        ['JWT_REFRESH_SECRET', 'Yes', 'Signing key for refresh tokens. Must be different from the access token key.'],
        ['ENCRYPTION_KEY', 'Yes', 'Key for patient identity encryption. Exactly 32 bytes, expressed as 64 hexadecimal characters.'],
      ],
      [1.2, 0.7, 3.4],
    );

    b.code(
      [
        '# Generate an encryption key (64 hex characters)',
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        '',
        '# Generate a token signing key',
        'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"',
      ].join('\n'),
    );

    b.note(
      'Changing the encryption key makes existing encrypted data unreadable',
      'Patient identity numbers already stored were encrypted with the current key. Replacing the key ' +
      'without re-encrypting the existing data renders those values permanently unrecoverable. Rotate ' +
      'this key only as part of a planned migration that decrypts with the old key and re-encrypts with ' +
      'the new one. The two token signing keys, by contrast, can be rotated freely — the only ' +
      'consequence is that every user is signed out.',
      'danger',
    );

    b.h(2, 'Email Settings');

    b.table(
      ['Variable', 'Required', 'Description'],
      [
        ['EMAIL_PROVIDER', 'Yes', 'Set to resend.'],
        ['RESEND_API_KEY', 'Yes', 'The email provider API key.'],
        ['RESEND_FROM', 'Yes', 'The sender address. Until a sending domain is verified, the provider default may be used, but production should send from a CareBridge address.'],
        ['EMAIL_LEGACY_SMTP_ENABLED', 'No', 'Enables the legacy direct-mail path. Leave false.'],
        ['EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS, EMAIL_FROM', 'No', 'Legacy direct-mail settings, used only when the legacy path is enabled.'],
      ],
      [1.6, 0.7, 3],
    );

    b.h(2, 'File Storage Settings');

    b.table(
      ['Variable', 'Required', 'Description'],
      [
        ['CLOUDINARY_CLOUD_NAME', 'Yes in production', 'File storage account name.'],
        ['CLOUDINARY_API_KEY', 'Yes in production', 'File storage key.'],
        ['CLOUDINARY_API_SECRET', 'Yes in production', 'File storage secret.'],
      ],
      [1.4, 0.9, 3],
    );

    b.note(
      'Without file storage credentials, uploads are lost on redeployment',
      'If these are unset the application writes uploaded files to its own filesystem. Hosting ' +
      'platforms replace that filesystem on every deployment, so verification documents, report files, ' +
      'and receipts uploaded since the last deployment would disappear. Configure file storage before ' +
      'accepting real users.',
      'danger',
    );

    b.h(2, 'Initial Administrator Settings');

    b.table(
      ['Variable', 'Description'],
      [
        ['ADMIN_NAME, ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD', 'Used once by the administrator seeding script to create the first administrator account. Change the seeded password immediately after first sign-in, and prefer creating named accounts for each operator so that audit entries identify a person.'],
      ],
      [1.6, 4],
    );

    b.h(2, 'Optional Integration Settings');

    b.p(
      'These are read by the application but are not present in the configuration template. They are ' +
      'documented here and, for the messaging integration, in a dedicated runbook in the repository.',
    );

    b.table(
      ['Variable', 'Description'],
      [
        ['JAZZCASH_MERCHANT_ID', 'Payment gateway merchant identifier.'],
        ['JAZZCASH_PASSWORD', 'Payment gateway password.'],
        ['JAZZCASH_INTEGRITY_SALT', 'Signing salt for request signatures and callback verification.'],
        ['JAZZCASH_RETURN_URL', 'The address the gateway returns to. Must be set explicitly — see the warning below.'],
        ['JAZZCASH_API_URL', 'Gateway address. Defaults to the sandbox.'],
        ['META_WA_ACCESS_TOKEN', 'Messaging access token.'],
        ['META_WA_PHONE_NUMBER_ID', 'Sending number identifier.'],
        ['META_WA_API_VERSION', 'Messaging API version.'],
        ['META_WA_USE_TEMPLATES', 'Whether to send using approved templates. Must be enabled to reach users outside the test allowlist.'],
        ['META_WA_TEMPLATE_OTP, _ALERT, _UTILITY, _LANGUAGE', 'Template names and language. These must match the approved templates exactly.'],
        ['META_WA_OTP_INCLUDE_NAME, META_WA_OTP_COPY_CODE', 'Optional message formatting behaviour.'],
      ],
      [1.7, 4],
    );

    b.note(
      'The payment gateway return address defaults to a path that does not exist',
      'The built-in default points at a path under /api, while the endpoint is served under /v1. If ' +
      'the payment integration is activated, JAZZCASH_RETURN_URL must be set explicitly to ' +
      '<BACKEND_URL>/v1/payments/jazzcash-callback. Left at the default, payment callbacks will not be ' +
      'received.',
      'danger',
    );

    b.h(2, 'Frontend Settings');

    b.table(
      ['Variable', 'Description'],
      [
        ['VITE_API_URL', 'The backend API address including the version prefix — for example https://api.carebridge.com/v1.'],
        ['VITE_SOCKET_URL', 'The backend address without the version prefix — for example https://api.carebridge.com.'],
      ],
      [1.3, 4],
    );

    b.note(
      'The two frontend addresses differ by the version prefix',
      'The API address includes /v1; the socket address does not. Setting both to the same value is the ' +
      'most common frontend deployment error, and it produces a working page on which live updates ' +
      'silently never arrive. These are build-time values — changing them requires a rebuild, not just ' +
      'a restart.',
      'warn',
    );

    // ---------------------------------------------------------------- 4
    b.h(1, 'Deployment Procedures');

    b.h(2, 'Backend Deployment');

    b.p(
      'The backend is deployed from source; there is no build step. Deployment configuration is ' +
      'committed to the repository, specifying the start command and an automatic restart policy on ' +
      'failure.',
    );

    b.bullets([
      'Connect the hosting project to the repository and set the root directory to the backend folder.',
      'Set every required environment variable from section 3. Verify each before the first deployment; a missing encryption key will prevent startup in production, which is the intended behaviour.',
      'Deploy. The platform installs dependencies and runs the start command.',
      'Confirm the service is running by requesting the health endpoint at the root address, which returns a plain confirmation string.',
      'On first deployment only, run the administrator seeding script to create the initial administrator account.',
      'Sign in as that administrator, change the seeded password, and create named administrator accounts.',
    ], { ordered: true });

    b.code(
      [
        '# Health check',
        'curl https://<backend-host>/',
        '# -> CareBridge API is running',
        '',
        '# Seed the first administrator (first deployment only)',
        'npm run seed:admin',
      ].join('\n'),
    );

    b.h(2, 'Frontend Deployment');

    b.p(
      'The frontend is a static build. Deployment configuration is committed to the repository and ' +
      'specifies the build command, output directory, single-page routing rewrites, and security ' +
      'response headers.',
    );

    b.bullets([
      'Connect the hosting project to the repository and set the root directory to the frontend folder.',
      'Set the two frontend environment variables. These are read at build time.',
      'Deploy. The platform installs dependencies, runs the build, and serves the output.',
      'Open the deployed address. The login page should load with platform branding applied, which confirms the frontend can reach the backend — branding is fetched from a public endpoint before sign-in.',
    ], { ordered: true });

    b.note(
      'Verifying the two channels separately',
      'A correctly configured API address but an incorrect socket address produces a page that looks ' +
      'entirely functional: sign-in works, data loads, and only live updates are missing. Test both ' +
      'explicitly — sign in as a hospital user, create a referral from a second browser as a ' +
      'consultant, and confirm it appears in the inbox without a page refresh.',
    );

    b.h(2, 'Local Development');

    b.code(
      [
        '# Backend',
        'cd backend',
        'npm install',
        'cp .env.example .env          # then fill in real values',
        'npm run dev                   # starts with automatic reload',
        '',
        '# Frontend, in a second terminal',
        'cd frontend',
        'npm install',
        'npm run dev                   # serves on http://localhost:5173',
        '',
        '# Run the test suite',
        'cd backend && npm test',
      ].join('\n'),
    );

    b.p(
      'The minimum configuration for local development is the database address, the two token signing ' +
      'keys, and the encryption key. Email, file storage, payment, and messaging settings are only ' +
      'needed to exercise those features.',
    );

    b.h(2, 'Go-Live Checklist');

    b.table(
      ['#', 'Action', 'Why'],
      [
        ['1', 'Rotate every shared secret — both token signing keys, the database password, and all third-party keys.', 'Any secret known to the development team should not remain in production after handover.'],
        ['2', 'Set CORS_ORIGINS to the exact production frontend address.', 'Blank means the API accepts requests from any origin.'],
        ['3', 'Set NODE_ENV to production.', 'Enforces the encryption key requirement rather than falling back to plaintext.'],
        ['4', 'Configure file storage credentials.', 'Without them, uploaded documents are lost on every redeployment.'],
        ['5', 'Verify the email sending domain and set the sender address.', 'Registration depends on email delivery; an unverified sender harms deliverability.'],
        ['6', 'Place the file upload endpoint behind authentication.', 'It is currently reachable without signing in. This is the highest-priority security action.'],
        ['7', 'Enable automated database backups and test a restore.', 'An untested backup is not a backup.'],
        ['8', 'Change the seeded administrator password and create named administrator accounts.', 'So that audit log entries identify an individual rather than a shared account.'],
        ['9', 'Confirm the escalation scheduler is running.', 'Referral escalation is a core guarantee; if the scheduler is not running, overdue referrals are never reassigned.'],
        ['10', 'Confirm live updates work end to end across two browsers.', 'Verifies the socket channel independently of the API channel.'],
      ],
      [0.4, 2.4, 3],
    );

    // ---------------------------------------------------------------- 5
    b.h(1, 'Third-Party Service Setup');

    b.h(2, 'Database');

    b.bullets([
      'Create a cluster and a database user with read and write access to the application database only.',
      'Restrict network access to the backend host where the platform supports it, rather than permitting all addresses.',
      'Enable automated backups and note the retention period.',
      'Take the connection string and set it as the database configuration value.',
    ]);

    b.note(
      'Geospatial indexes are created automatically',
      'Consultant, hospital, and laboratory records carry geographic indexes, created by the ' +
      'application on startup. These support distance scoring and the emergency proximity fallback. No ' +
      'manual index creation is required, but the database tier must support them.',
    );

    b.h(2, 'File Storage');

    b.bullets([
      'Create an account and take the cloud name, key, and secret from the dashboard.',
      'Set the three configuration values on the backend.',
      'Verify by uploading a verification document through a registration form and confirming the resulting file is reachable.',
    ]);

    b.note(
      'Stored documents are reachable by direct link',
      'Files are served by the storage provider without an authentication check. Anyone holding a file ' +
      'address can retrieve it. Addresses are long and unguessable, and are only disclosed to ' +
      'authorised users, but this is not equivalent to access control. Where verification documents and ' +
      'patient reports are involved, moving to time-limited signed addresses is recommended in the ' +
      'Security and Compliance document.',
      'warn',
    );

    b.h(2, 'Email');

    b.bullets([
      'Create an account and generate an API key.',
      'Verify the sending domain by adding the DNS records the provider specifies. Until this is done, mail sends from the provider default address and is more likely to be filtered.',
      'Set the key and sender address on the backend.',
      'Verify by registering a test account and confirming the verification code arrives.',
    ]);

    b.h(2, 'WhatsApp Messaging (Optional)');

    b.p(
      'The integration is implemented but requires the client to complete business verification and ' +
      'message template approval before messages reach real users. A detailed runbook is included in ' +
      'the repository documentation folder.',
    );

    b.bullets([
      'Complete Meta Business verification for the organisation.',
      'Create and submit two message templates for approval: an authentication template carrying the one-time code, and a utility template for notifications.',
      'Once approved, set the access token, sending number identifier, template enablement flag, and the template names and language.',
      'Verify by sending a test message to a number outside the sandbox allowlist.',
    ], { ordered: true });

    b.note(
      'Why messages reach test numbers but not real users',
      'Before template approval, the messaging platform only delivers to numbers on a sandbox ' +
      'allowlist. This produces the confusing symptom that the integration appears to work during ' +
      'testing and silently fails for real users. Template names must also match the approved templates ' +
      'exactly — a mismatch fails delivery without an obvious error.',
      'warn',
    );

    b.h(2, 'Payment Gateway (Optional)');

    b.p(
      'The integration implements the signed redirect checkout, including request signing and callback ' +
      'signature verification. It is not required for operation — the platform runs on the manual ' +
      'receipt-based settlement cycle.',
    );

    b.bullets([
      'Obtain live merchant credentials: merchant identifier, password, and integrity salt.',
      'Set them on the backend, together with the gateway address.',
      'Set the return address explicitly to the callback endpoint under the version prefix. The built-in default is wrong.',
      'Individual hospitals may hold their own merchant credentials on their record, which take precedence over the platform values.',
    ]);

    // ---------------------------------------------------------------- 6
    b.h(1, 'Operations');

    b.h(2, 'Routine Checks');

    b.table(
      ['Frequency', 'Check', 'Action if it fails'],
      [
        ['Daily', 'The backend health endpoint responds.', 'Inspect the platform logs; the restart policy should recover automatically from a crash. A repeated crash indicates a defect or a resource limit.'],
        ['Daily', 'The registration approval queue has been worked.', 'Applicants cannot sign in until approved. A neglected queue is the most common source of user complaints.'],
        ['Daily', 'No settlement has been waiting for verification longer than agreed.', 'Facilities cannot close their cycle and consultants are not paid until an administrator verifies.'],
        ['Weekly', 'Backups completed and are within the retention window.', 'Investigate with the database provider immediately. Backups are the only recovery mechanism.'],
        ['Weekly', 'The audit log has been reviewed for unexpected administrative activity.', 'Investigate the actor. Suspend the account if the activity is not accounted for.'],
        ['Monthly', 'A restore into a test environment succeeds.', 'An untested backup cannot be relied upon.'],
        ['Monthly', 'Dependency security advisories reviewed.', 'Apply security updates; see the Maintenance and Support Guide.'],
      ],
      [0.8, 2.2, 3],
    );

    b.h(2, 'Monitoring');

    b.p(
      'The platform has no dedicated monitoring stack. The hosting platforms provide process logs, ' +
      'restart history, and resource metrics, which are the primary operational signal. The following ' +
      'should be watched.',
    );

    b.bullets([
      'Process restarts — the backend restarts automatically on failure, so repeated restarts indicate a recurring fault that would otherwise go unnoticed.',
      'Escalation scheduler activity — the job runs every minute and logs its work. Silence means overdue referrals are not being reassigned.',
      'Email delivery failures — a registration cannot complete if the verification code does not arrive.',
      'Database connection errors — the application connects at startup and would fail to serve requests without it.',
      'Response times — a slow ranking query suggests the hospital set has grown beyond what the current approach handles comfortably.',
    ]);

    b.note(
      'Recommended addition',
      'An uptime check against the health endpoint, alerting on failure, is the single highest-value ' +
      'operational addition. Without it, an outage is discovered by users rather than by the operator.',
    );

    b.h(2, 'Scheduled Job');

    b.table(
      ['Job', 'Schedule', 'Function'],
      [
        ['Referral escalation', 'Every minute', 'Selects pending referrals past their response deadline and reassigns them to the next ranked hospital, or — for emergencies with an exhausted queue — to the nearest alternative within twenty kilometres, or rejects them automatically when no option remains.'],
      ],
      [1.2, 0.9, 3.4],
    );

    b.p(
      'The job runs inside the API process and starts with it. There is no separate service to manage. ' +
      'Its correct functioning is a core guarantee of the platform and should be treated as ' +
      'operationally significant.',
    );

    b.h(2, 'Maintenance Scripts');

    b.table(
      ['Command', 'Effect'],
      [
        ['npm run seed:admin', 'Creates the initial administrator account from the configured values. Safe to run once on a new deployment.'],
        ['npm run cleanup:legacy-hospitals', 'Removes legacy seeded hospital records. Intended for cleaning a development database.'],
        ['npm test', 'Runs the automated test suite. Requires no database.'],
      ],
      [1.5, 4],
    );

    b.note(
      'Seeding and cleanup scripts modify data directly',
      'The repository also contains development scripts under the scripts and scratch folders that ' +
      'write to the database. Never run any of them against production without reading the script ' +
      'first. Several will delete or overwrite records.',
      'danger',
    );

    // ---------------------------------------------------------------- 7
    b.h(1, 'Backup and Recovery');

    b.h(2, 'What Must Be Backed Up');

    b.table(
      ['Asset', 'Where it lives', 'Backup approach'],
      [
        ['Application data', 'MongoDB', 'Automated provider backups. This is the critical asset — it holds every user, referral, admission, payout, and settlement.'],
        ['Uploaded documents', 'Cloudinary', 'Held by the storage provider. Confirm the provider\'s own retention and consider a periodic export of the asset inventory.'],
        ['Configuration', 'Hosting platform environment variables', 'Not backed up automatically. Keep an offline copy of the variable names and values in a password manager.'],
        ['Source code', 'Git repository', 'Backed up by the hosting of the repository itself. Ensure the client organisation owns the repository after handover.'],
      ],
      [1.1, 1.4, 3],
    );

    b.h(2, 'Backup Policy');

    b.bullets([
      'Enable automated daily database backups with a retention period of at least thirty days.',
      'Verify monthly that backups are completing, by inspecting the provider\'s backup history rather than assuming.',
      'Test a restore into a separate database at least quarterly. A restore that has never been performed is an assumption, not a capability.',
      'Store the configuration inventory — every environment variable name and value — in a password manager accessible to more than one person.',
    ]);

    b.h(2, 'Recovery Procedure');

    b.p('To recover the application from a database backup:');

    b.bullets([
      'Provision a new database instance and restore the chosen backup into it.',
      'Confirm the restored data is intact — check that recent referrals and settlements are present and consistent.',
      'Update the database connection value on the backend host to point at the restored instance.',
      'Restart the backend and confirm the health endpoint responds.',
      'Sign in and verify a referral, an admission, and a settlement each load correctly.',
      'Confirm the escalation scheduler is running by checking the logs.',
    ], { ordered: true });

    b.note(
      'The encryption key must match the restored data',
      'Patient identity numbers in the restored data were encrypted with the key in force when they ' +
      'were written. Restoring data alongside a different encryption key leaves those values ' +
      'unreadable. Keep the encryption key with the backup record, and never rotate it without a ' +
      'planned data migration.',
      'danger',
    );

    b.h(2, 'Recovery Expectations');

    b.table(
      ['Scenario', 'Expected recovery'],
      [
        ['Backend process failure', 'Automatic. The restart policy recovers the process without intervention.'],
        ['Bad deployment', 'Minutes. Both hosting platforms retain previous deployments and support rollback.'],
        ['Database corruption or accidental deletion', 'Hours, bounded by restore time. Data written since the last backup is lost — this is the principal argument for daily backups.'],
        ['Third-party service outage', 'Bounded by that provider. Email and messaging failures degrade the affected notifications without failing the operations that raised them. A file storage outage prevents uploads. A database outage stops the platform.'],
      ],
      [1.3, 3.6],
    );

    // ---------------------------------------------------------------- 8
    b.h(1, 'Scaling');

    b.h(2, 'Current Constraint');

    b.p(
      'The backend must run as a single instance. Two components prevent horizontal scaling, and both ' +
      'must be addressed before the replica count is increased.',
    );

    b.table(
      ['Constraint', 'Effect if scaled', 'Remedy'],
      [
        ['One-time-password state is held in process memory', 'A verification code issued by one instance is unknown to another, so verification fails whenever the two requests land on different instances. Codes are also lost on restart.', 'Move the store to a shared cache such as Redis.'],
        ['The escalation scheduler runs inside the API process', 'Each instance runs the job, so a referral could be escalated more than once in the same minute.', 'Extract the scheduler to a dedicated worker process, or introduce a distributed lock so only one instance acts.'],
      ],
      [1.4, 2.6, 2],
    );

    b.h(2, 'Scaling Path');

    b.p(
      'Until those two changes are made, growth is accommodated vertically — increasing the resources ' +
      'allocated to the single instance — which is adequate for the expected scale. When horizontal ' +
      'scaling becomes necessary, the recommended order is: introduce a shared cache and move the ' +
      'one-time-password store into it; extract the scheduler to a worker; add a socket adapter so ' +
      'real-time events reach clients connected to any instance; then increase the replica count.',
    );

    b.note(
      'Socket connections need an adapter before scaling',
      'Room-based event delivery currently works because all connections terminate on one instance. ' +
      'With several instances, an event emitted on one would not reach a client connected to another. A ' +
      'shared adapter is required at the same time as the replica increase, not after it.',
      'warn',
    );

    // ---------------------------------------------------------------- 9
    b.h(1, 'Troubleshooting Runbook');

    b.h(2, 'The Application Will Not Start');

    b.table(
      ['Symptom', 'Cause', 'Resolution'],
      [
        ['Startup fails with an encryption key error', 'The encryption key is missing or is not 64 hexadecimal characters, and the environment is production.', 'Set a valid key. This check is deliberate — it prevents production from silently storing patient identity numbers in plaintext.'],
        ['Database connection refused', 'Wrong connection string, or the database network rules exclude the backend host.', 'Verify the connection string and add the host to the database access list.'],
        ['Database name resolution fails', 'The network cannot resolve the database service record — most often an IPv6 or router issue.', 'The application already forces IPv4 and specifies public resolvers to work around this. If it persists, the network is blocking the lookup.'],
        ['Port already in use', 'Another process holds the port.', 'Stop the other process or set a different port.'],
      ],
      [1.3, 1.6, 2.6],
    );

    b.h(2, 'Users Cannot Sign In');

    b.table(
      ['Symptom', 'Cause', 'Resolution'],
      [
        ['Told the account is pending', 'The registration has not been approved.', 'Approve it in the approvals queue. This is normal behaviour, not a fault.'],
        ['Told email verification is outstanding', 'The verification code was never entered.', 'The user resends the code from the login page. If codes are never arriving, investigate email delivery.'],
        ['Verification codes never arrive', 'Email delivery is failing, or the sending domain is unverified and mail is being filtered.', 'Check the email provider dashboard for failures. Verify the sending domain. Check the recipient\'s spam folder.'],
        ['Verification codes stop working after a deployment', 'Codes are held in process memory and do not survive a restart.', 'Users request a fresh code. This is a known constraint; the remedy is a shared cache, in section 8.'],
        ['Signed out unexpectedly during use', 'Session renewal is failing, or the account was suspended.', 'Check the account status. Suspending an account ends its sessions at the next renewal, which is the intended behaviour.'],
        ['All users signed out at once', 'A token signing key was changed.', 'Expected. Users sign in again; no data is affected.'],
      ],
      [1.3, 1.6, 2.6],
    );

    b.h(2, 'Referrals and Escalation');

    b.table(
      ['Symptom', 'Cause', 'Resolution'],
      [
        ['No hospitals appear in recommendations', 'Every hospital was excluded by a hard filter — no matching department, or no free bed in the required ward. Emergencies require an intensive care bed specifically.', 'Check that hospitals operate the department and have current bed counts. Stale bed counts are the most common cause.'],
        ['Overdue referrals are not escalating', 'The scheduler is not running.', 'Check the backend logs for the per-minute job. Restart the service if it is absent.'],
        ['A referral escalated unexpectedly', 'The hospital did not respond within its deadline.', 'Expected behaviour. The deadline is set by urgency: fifteen minutes, two hours, or twenty-four hours.'],
        ['A hospital receives no referrals', 'It is not activated, does not operate the required departments, shows no available beds, or has a poor response record.', 'Check activation status, departments, and bed counts first — these are hard filters. Response history only lowers ranking; it does not exclude.'],
        ['Distance scoring looks wrong', 'Coordinates were entered in the wrong order.', 'Coordinates are stored longitude first. Reversed values place the facility in the wrong location and silently corrupt distance for that record.'],
      ],
      [1.3, 1.8, 2.6],
    );

    b.h(2, 'Financial Discrepancies');

    b.table(
      ['Symptom', 'Cause', 'Resolution'],
      [
        ['A commission figure is disputed', 'Terms changed after the case was billed.', 'Every payout carries a snapshot of the terms applied at the time. Read the snapshot on the payout record — it is the authoritative record of how the figure was produced.'],
        ['An amount is one hundred times too large or too small', 'Rupees were supplied where paisa were expected, or the reverse.', 'All monetary values are whole paisa. Check the conversion at the point of entry.'],
        ['A facility\'s residual is negative', 'A fixed charge exceeds a very small bill.', 'Arithmetically correct and reported faithfully by design. This is a commercial configuration question — review whether a fixed charge is appropriate at that bill size.'],
        ['A settlement will not complete', 'One or more consultant payouts are unconfirmed.', 'The settlement completes only when every consultant confirms receipt. Identify the outstanding consultants and follow up.'],
        ['A rate change did not take effect', 'An override at a more specific tier is taking precedence.', 'Terms resolve as consultant-facility override, then facility, then platform default. Check for an override before changing a default.'],
      ],
      [1.3, 1.6, 2.8],
    );

    b.h(2, 'Real-Time and Interface Issues');

    b.table(
      ['Symptom', 'Cause', 'Resolution'],
      [
        ['Screens do not update live', 'The socket address is wrong, or the user\'s network blocks the connection.', 'The socket address must not include the version prefix, unlike the API address. This is the most common cause. Verify across two browsers.'],
        ['Live updates work locally but not in production', 'The socket address was not rebuilt into the frontend.', 'The frontend addresses are build-time values. Rebuild after changing them.'],
        ['Requests fail with a cross-origin error', 'The frontend address is not in the allowed origins list.', 'Add the exact address, without a trailing slash, and restart the backend.'],
        ['Uploaded files are missing after a deployment', 'File storage is not configured, so files were written to the application filesystem.', 'Configure file storage credentials. Files lost this way cannot be recovered.'],
        ['The interface shows the wrong branding', 'Platform or hospital branding was changed and the page has not reloaded.', 'Reload the page. Hospital branding overrides platform branding for that hospital\'s users, which is intended.'],
      ],
      [1.3, 1.6, 2.8],
    );

    b.h(2, 'Escalating a Problem');

    b.p(
      'When reporting a problem that this runbook does not resolve, gather: the exact time and time ' +
      'zone; the affected user\'s role and email; the referral or settlement code if applicable; the ' +
      'exact error text; the backend logs for the surrounding period; and whether the problem is ' +
      'reproducible or occurred once. The first three are usually enough to locate the relevant records ' +
      'and log entries.',
    );
  },
};
