const { meta } = require('../common');

module.exports = {
  meta: meta(
    'CB-UM-2026-007',
    'User Manual',
    'Step-by-step operating guide for consultants, hospitals, laboratories, and platform administrators',
  ),

  body(b) {
    // ---------------------------------------------------------------- 1
    b.h(1, 'About This Manual');

    b.p(
      'This manual explains how to use the CareBridge platform day to day. It is organised by role: ' +
      'each of the four user types has its own chapter covering registration, the screens available to ' +
      'that role, and the tasks performed on them. Readers only need the chapter matching their role, ' +
      'plus the common material in this chapter and in Chapter 2.',
    );

    b.h(2, 'Who Uses CareBridge');

    b.table(
      ['Role', 'Who they are', 'What they do on the platform'],
      [
        ['Consultant', 'Referring doctors and clinicians in private practice or clinics',
          'Create patient referrals to hospitals and laboratories, track patient progress, and receive commission earnings.'],
        ['Hospital', 'Hospital administrators and their team members',
          'Receive referrals, accept or reject them against a response deadline, admit and bill patients, manage beds and doctors, and settle accounts with the platform.'],
        ['Laboratory', 'Diagnostic laboratory administrators and staff',
          'Receive laboratory referrals, commit to a report deadline, upload reports, bill for tests, and settle accounts.'],
        ['Administrator', 'CareBridge platform staff',
          'Approve new registrations, configure commercial terms and the matching engine, oversee all referrals, verify settlements, and release payouts.'],
      ],
      [1.1, 2.2, 4],
    );

    b.h(2, 'Accessing the Platform');

    b.p(
      'CareBridge is a web application. It requires no installation — only a current web browser ' +
      '(Chrome, Edge, Firefox, or Safari) and an internet connection. The platform works on desktop, ' +
      'tablet, and mobile; on smaller screens the sidebar menu is replaced by a scrolling navigation ' +
      'bar at the top of the page.',
    );

    b.note(
      'Sign-in address',
      'Your administrator will provide the web address for your CareBridge portal. Open it in your ' +
      'browser and bookmark it. All roles sign in through the same login page — the platform sends you ' +
      'to the correct dashboard automatically based on your account type.',
    );

    b.h(2, 'Conventions Used in This Manual');

    b.bullets([
      'Screen names — appear as they do in the navigation menu, for example My Referrals.',
      'Buttons and fields — named exactly as they appear on screen.',
      'Money — all amounts are shown in Pakistani Rupees and written as PKR 12,345.',
      'Notes — highlighted boxes contain prerequisites, warnings, or information that prevents a common mistake.',
    ]);

    // ---------------------------------------------------------------- 2
    b.h(1, 'Getting Started — Common to All Roles');

    b.h(2, 'Creating an Account');

    b.p(
      'Every organisation and individual registers themselves; there is no bulk account creation. ' +
      'Registration follows the same four stages for all roles, and access is only granted after a ' +
      'platform administrator has reviewed and approved the application.',
    );

    b.diagram(
      'The registration and approval journey',
      String.raw`
   +---------------+   +---------------+   +---------------+   +---------------+
   |  1. Complete  |   |  2. Verify    |   |  3. Admin     |   |  4. Sign in   |
   |     the form  |-->|     your      |-->|     reviews   |-->|     and start |
   |  + documents  |   |     email     |   |     documents |   |     working   |
   +---------------+   +---------------+   +---------------+   +---------------+
        you                  you                CareBridge            you
                                             (1-2 working days)
`,
    );

    b.h(3, 'Step 1 — Complete the registration form');

    b.p(
      'From the login page choose Register, then select the card that matches you: Consultant, ' +
      'Hospital, or Laboratory. Complete every field on the form. The information required differs ' +
      'by role and is listed in the table below.',
    );

    b.table(
      ['Role', 'Information required'],
      [
        ['Consultant',
          'Full name, email, mobile number, password, PMDC registration number, CNIC, specialty, clinic name and address, and clinic location (use Detect my location to capture coordinates automatically).'],
        ['Hospital',
          'Hospital name, email, mobile number, password, hospital registration number, representative CNIC, full address, map location, the departments you operate, and your starting bed count for each ward type.'],
        ['Laboratory',
          'Laboratory name, email, mobile number, password, registration number, representative CNIC, city, area, address, map location, and your initial test catalogue (test name, price, and turnaround time in hours).'],
      ],
      [1, 4],
    );

    b.h(3, 'Step 2 — Upload your verification documents');

    b.p(
      'Applications cannot be approved without supporting documents. Upload clear scans or photographs; ' +
      'each file must be readable, or the administrator will reject the application and you will need ' +
      'to resubmit.',
    );

    b.table(
      ['Role', 'Documents to upload'],
      [
        ['Consultant', 'PMDC registration certificate, CNIC (front and back).'],
        ['Hospital', 'Hospital registration certificate, representative CNIC (front and back).'],
        ['Laboratory', 'Laboratory registration or licence certificate, representative CNIC (front and back).'],
      ],
      [1, 4],
    );

    b.p(
      'Before you can submit, you must open and read the Standard Operating Procedure and privacy ' +
      'policy shown on the form, then tick the agreement box. Use the expand icon to view the document ' +
      'full screen.',
    );

    b.h(3, 'Step 3 — Verify your email address');

    b.p(
      'On submitting the form you are taken to the verification screen and CareBridge emails you a ' +
      'six-digit code. Enter the code in the boxes provided. If the email has not arrived within a few ' +
      'minutes, check your spam folder, then use Resend code — a short cooldown applies between resends.',
    );

    b.h(3, 'Step 4 — Wait for approval, then sign in');

    b.p(
      'Your account is created with a pending status. A platform administrator reviews your details and ' +
      'documents, and either activates the account or rejects it with a reason. You are notified by ' +
      'email. Once active, sign in at the login page and you are taken straight to your dashboard.',
    );

    b.note(
      'If you cannot sign in',
      'A pending account cannot sign in — the platform will tell you the account is awaiting approval. ' +
      'If more than two working days have passed, contact the CareBridge administrator. If you see a ' +
      'message about email verification, use the resend link on the login page to get a fresh code.',
      'warn',
    );

    b.h(2, 'Signing In and Signing Out');

    b.bullets([
      'Sign in — enter your registered email and password on the login page. You are routed to the dashboard for your role.',
      'Stay signed in — your session refreshes itself automatically while you are working. You will not be logged out mid-task.',
      'Session expiry — after a long period of inactivity you are returned to the login page. Sign in again; no work is lost because everything you save is stored immediately.',
      'Sign out — use Sign out at the bottom of the sidebar. Always sign out on shared or public computers.',
    ]);

    b.h(2, 'Resetting a Forgotten Password');

    b.bullets([
      'On the login page choose Forgot password.',
      'Enter your registered email address and submit.',
      'Open the email from CareBridge and click the reset link it contains.',
      'Enter a new password of at least eight characters, confirm it, and submit. You are returned to the login page to sign in with the new password.',
    ], { ordered: true });

    b.note(
      'Reset links expire',
      'The password reset link is valid for a limited period and can be used only once. If it has expired, ' +
      'simply request a new one. An administrator can also reset your password for you on request.',
    );

    b.h(2, 'Your Profile');

    b.p(
      'Profile settings is available to every role from the bottom of the sidebar. Use it to update your ' +
      'name and mobile number, change your password, and manage your verification documents. Documents ' +
      'that an administrator has already verified are locked and cannot be replaced — contact the ' +
      'administrator if a verified document needs to change.',
    );

    b.p(
      'Hospital users have two additional sections on this screen: department management, and branding. ' +
      'Branding lets a hospital upload its own logo and choose a primary colour, which is then applied ' +
      'across the portal for that hospital\'s users.',
    );

    b.h(2, 'Notifications');

    b.p(
      'The bell icon in the top-right corner shows a count of unread notifications. Notifications arrive ' +
      'live — you do not need to refresh the page. Click the bell to open the list, click any item to ' +
      'mark it as read, or use Mark all as read to clear the counter. Short pop-up messages also appear ' +
      'in the top-right corner to confirm actions and report errors.',
    );

    b.h(2, 'Switching Between Light and Dark Mode');

    b.p(
      'The theme toggle in the sidebar switches between light and dark appearance. Your choice is ' +
      'remembered on that browser. By default CareBridge follows your device setting.',
    );

    // ---------------------------------------------------------------- 3
    b.h(1, 'Consultant Guide');

    b.p(
      'As a consultant you refer patients to hospitals and laboratories, follow their progress, and earn ' +
      'commission on completed cases. Your menu contains: Dashboard, New referral, My referrals, ' +
      'Earnings, Laboratory, and Profile settings.',
    );

    b.h(2, 'Your Dashboard');

    b.p(
      'The dashboard opens on sign-in and summarises your activity: total referrals created, how many ' +
      'were accepted, and your total earnings. Below the figures is a list of your most recent referrals ' +
      'with their current status.',
    );

    b.h(2, 'Creating a Hospital Referral');

    b.p(
      'New referral opens a four-step wizard. A progress bar at the top shows where you are. You can move ' +
      'back to an earlier step at any time without losing what you have entered.',
    );

    b.h(3, 'Step 1 — Patient information');

    b.bullets([
      'Patient name — the patient\'s full name.',
      'CNIC — the patient\'s national identity number. This is stored encrypted and is visible only to authorised users.',
      'Guardian — select the relation (S/O, D/O, W/O) and enter the guardian\'s name.',
      'Age or date of birth — enter either. Typing an age in years, months, or days fills in an approximate date of birth automatically, which is useful for infants.',
      'Gender and contact number — used by the hospital to reach the patient.',
    ]);

    b.h(3, 'Step 2 — Clinical assessment');

    b.bullets([
      'Symptoms — enter the presenting symptoms separated by commas. The platform uses these to suggest the correct hospital department, so be specific.',
      'Clinical summary — free-text notes for the receiving hospital.',
      'Urgency — choose Routine, Urgent, or Emergency. This sets the hospital\'s response deadline, so use Emergency only for genuine emergencies.',
      'Required ward type — for example General, Private, ICU, or NICU. Hospitals with beds free in that ward rank higher in your recommendations.',
      'Attachments — upload prior reports, scans, or images for the receiving hospital to review.',
    ]);

    b.h(3, 'Step 3 — Preferences and location');

    b.p(
      'Enter the patient\'s area, then choose Find best hospitals. CareBridge scores every eligible ' +
      'hospital against your referral and returns them in ranked order.',
    );

    b.h(3, 'Step 4 — Choosing a hospital and submitting');

    b.p(
      'Each recommendation card shows the hospital and why it was ranked where it is — department match, ' +
      'free beds in the ward you need, distance from the patient, and the hospital\'s record of ' +
      'responding on time. Expand a card to choose a department and, if you wish, a specific doctor. ' +
      'Then submit the referral. You may submit to more than one hospital if you want parallel options; ' +
      'each becomes a separate referral you can track independently.',
    );

    b.note(
      'Marking favourites',
      'The star icon on a hospital card saves that hospital as a favourite. Favourites are given extra ' +
      'weight in your future recommendations, so the platform gradually learns where you prefer to refer.',
    );

    b.h(2, 'Tracking Your Referrals');

    b.p(
      'My referrals lists everything you have created. Filter by status or search by patient name or ' +
      'referral code. Click a referral to open its full detail, including the clinical notes timeline ' +
      'where hospital staff record the patient\'s progress.',
    );

    b.table(
      ['Status', 'What it means', 'What you can do'],
      [
        ['Pending', 'Sent to the hospital, awaiting their response.', 'Edit the referral, or wait. The hospital is working against a response deadline.'],
        ['Accepted', 'The hospital has accepted the patient.', 'Edit the referral, and follow the clinical notes.'],
        ['Rejected', 'The hospital declined, with a stated reason.', 'Read the reason, then create a new referral to a different hospital.'],
        ['Admitted', 'The patient has been admitted.', 'Follow progress in the clinical notes. The referral can no longer be edited.'],
        ['Closed', 'The patient has been discharged and the case billed.', 'Your commission is calculated at this point and appears in Earnings.'],
      ],
      [1, 2.4, 3],
    );

    b.p(
      'Use the download icon on any referral to save a PDF summary — useful for your own records or for ' +
      'sharing with the patient.',
    );

    b.h(2, 'Laboratory Referrals');

    b.p(
      'The Laboratory screen has three tabs and works much like hospital referrals.',
    );

    b.bullets([
      'New referral — enter the patient details, list the tests you are ordering, optionally apply a discount for the patient, then either let the platform suggest laboratories or choose one by name.',
      'My referrals — track progress through Pending, Accepted, Reported, and Closed. If a laboratory rejects a referral you can re-refer the same case to a different laboratory without re-entering the details.',
      'Lab earnings — your commission on laboratory referrals, and confirmation of payouts received.',
    ]);

    b.note(
      'Test names are fixed once submitted',
      'The laboratory can set the price of each test but cannot change which tests you ordered. If the ' +
      'required tests change, contact the laboratory directly and raise a new referral.',
    );

    b.h(2, 'Earnings and Withdrawals');

    b.p(
      'Earnings shows your wallet balance, a breakdown of commission by referral, and the history of ' +
      'payouts made to you. Use the export button to download a complete earnings statement as a PDF.',
    );

    b.h(3, 'How your commission is earned');

    b.bullets([
      'A hospital admits your patient, treats them, and bills the case on discharge.',
      'The platform deducts its charge from the hospital bill according to the agreed terms.',
      'Your commission is calculated from the platform charge and credited to your wallet.',
      'The balance becomes available for withdrawal once it passes the platform\'s minimum threshold.',
    ], { ordered: true });

    b.h(3, 'Requesting a withdrawal');

    b.p(
      'Choose Withdraw and follow the two steps: select your payout method, then enter the amount and ' +
      'your mobile wallet number. A minimum withdrawal of PKR 500 applies and the amount cannot exceed ' +
      'your available balance.',
    );

    b.h(3, 'Confirming a payout you have received');

    b.p(
      'When the administrator releases a payout they upload a receipt against it. The payout appears in ' +
      'your Earnings screen awaiting your confirmation. Check that the money has reached your account, ' +
      'then confirm receipt. This closes the settlement and is required for the platform\'s records.',
    );

    b.note(
      'Confirm only what you have actually received',
      'Confirming receipt is your formal acknowledgement that the funds arrived. If a payout is marked ' +
      'as sent but has not reached you, do not confirm it — contact the platform administrator instead.',
      'warn',
    );

    // ---------------------------------------------------------------- 4
    b.h(1, 'Hospital Guide');

    b.p(
      'As a hospital you receive referrals from consultants, decide whether to accept them, admit and ' +
      'treat patients, bill completed cases, and settle with the platform. Your menu contains: ' +
      'Dashboard, Inbox, Emergency, All referrals, Admissions, Beds, Departments, Doctors, Ledger, ' +
      'Settlements, Team, and Profile settings.',
    );

    b.h(2, 'Your Dashboard');

    b.p(
      'The dashboard shows total referrals received, how many are waiting in your inbox, how many ' +
      'patients are currently admitted, and your billed revenue, with a chart of referral volume over ' +
      'time.',
    );

    b.h(2, 'Responding to Referrals — The Inbox');

    b.p(
      'Inbox is the screen your team should work from continuously. It holds every referral awaiting ' +
      'your response. The number beside Inbox in the menu is your outstanding count.',
    );

    b.p(
      'Each card shows the patient, the referring consultant, the symptoms, the ward type requested, the ' +
      'urgency, and a countdown to your response deadline. The countdown updates every second and turns ' +
      'to OVERDUE when the deadline passes. Cards are colour-coded by urgency, with emergencies shown ' +
      'in red.',
    );

    b.note(
      'Response deadlines affect your ranking',
      'CareBridge tracks how reliably your hospital responds within the deadline, and that record is one ' +
      'of the factors used to rank hospitals in consultants\' recommendations. Responding promptly — even ' +
      'to reject — directly increases the referrals you receive.',
      'warn',
    );

    b.h(3, 'Accepting a referral');

    b.p(
      'Choose Accept. You must select the department that will take the patient before the acceptance ' +
      'can be saved. The consultant is notified immediately and the referral moves to your admissions ' +
      'pipeline.',
    );

    b.h(3, 'Rejecting a referral');

    b.p(
      'Choose Reject. You must give a reason — for example no beds available in the requested ward, or ' +
      'the required specialty is not on duty. The reason is shown to the consultant so they can refer ' +
      'the patient elsewhere quickly.',
    );

    b.h(3, 'The Emergency screen');

    b.p(
      'Emergency shows only emergency referrals that are still awaiting a response, on a dedicated ' +
      'triage board. Use it during busy periods so urgent cases are never buried among routine ones. ' +
      'Accepting and rejecting work exactly as they do in the inbox.',
    );

    b.h(2, 'Admitting and Billing Patients');

    b.p(
      'Admissions is where an accepted referral becomes an admitted patient and, eventually, a bill. The ' +
      'screen has two parts: the pipeline of accepted referrals not yet admitted, and the list of ' +
      'patients currently admitted.',
    );

    b.h(3, 'Admitting a patient');

    b.p(
      'Find the patient in the pipeline and choose Admit. Record the admission details — ward and room, ' +
      'bed number, department, and the treating doctor. The referral status changes to Admitted and the ' +
      'consultant is notified.',
    );

    b.h(3, 'Recording clinical notes');

    b.p(
      'Open any referral and use the clinical notes timeline to record the patient\'s progress. Notes can ' +
      'be logged as nursing notes or consultant notes. The referring consultant sees these notes, which ' +
      'is how they follow their patient without telephoning the ward.',
    );

    b.h(3, 'Completing and billing a case');

    b.p(
      'When the patient is discharged, choose Complete case on their admission record. Build the bill ' +
      'line by line — enter a description and amount for each service provided; the total is calculated ' +
      'for you. Record the payment method and reference, attach a copy of the patient bill, and submit.',
    );

    b.note(
      'Completing a case is what triggers the money flow',
      'Billing the case sets the referral to Closed, calculates the platform charge and the consultant\'s ' +
      'commission, and makes the admission available for inclusion in a settlement. Check the line items ' +
      'carefully before submitting.',
      'warn',
    );

    b.h(2, 'Managing Beds');

    b.p(
      'Beds shows a card for each ward type with total, occupied, and available beds. Use the plus and ' +
      'minus buttons for quick day-to-day adjustments, or the edit control to set the total and occupied ' +
      'counts directly.',
    );

    b.note(
      'Keep bed counts current',
      'Bed availability is one of the strongest factors in how consultants\' recommendations are ranked. ' +
      'A hospital showing no free beds in a ward will rarely be recommended for that ward. Update the ' +
      'counts at each shift change.',
    );

    b.h(2, 'Departments and Doctors');

    b.bullets([
      'Departments — add or remove the departments your hospital operates. Referrals are matched to departments, so this list determines which referrals reach you.',
      'Doctors — maintain your doctor list with specialty, PMDC number, consultation fee, and contact details. Mark a doctor unavailable to remove them from consultants\' selection lists without deleting the record.',
    ]);

    b.h(2, 'Financial Ledger');

    b.p(
      'Ledger is your financial record of every completed case: the amount billed, the platform charge ' +
      'deducted, and your net. Search by referral code, patient, or consultant, click any row for the ' +
      'detail, and export the whole ledger to CSV for your accounts department.',
    );

    b.h(2, 'Settlements');

    b.p(
      'Settlements is how you pay the platform its charges for a billing period. The process is a ' +
      'four-stage cycle.',
    );

    b.diagram(
      'The hospital settlement cycle',
      String.raw`
  HOSPITAL                          ADMIN                        CONSULTANT
     |                                |                               |
  1. Bundle admissions                |                               |
     into a billing window            |                               |
     + upload summary                 |                               |
     |                                |                               |
  2. Pay the platform  -------------> |                               |
     + upload receipt              3. Verify the receipt              |
     |                                |                               |
     |                             4. Release consultant  ----------> |
     |                                payouts + receipts        5. Confirm
     |                                |                            receipt
     |                                |                               |
     +------------------ settlement COMPLETED ----------------------- +
`,
    );

    b.bullets([
      'Select the completed admissions to include and set the billing period start and end dates.',
      'Attach a summary file and any notes, then create the settlement.',
      'Pay the platform charge by your agreed method, then upload the payment receipt against the settlement.',
      'The administrator verifies your receipt. If it is rejected you will see the reason and can upload a corrected receipt.',
      'Once verified, the platform releases the consultants\' payouts and the settlement closes.',
    ], { ordered: true });

    b.h(2, 'Managing Your Team');

    b.p(
      'Team lets you create logins for your own staff so several people can work the inbox and ' +
      'admissions concurrently. Each member you add gets a full account in the hospital portal. You can ' +
      'remove members you created, but not the person who created your account.',
    );

    // ---------------------------------------------------------------- 5
    b.h(1, 'Laboratory Guide');

    b.p(
      'As a laboratory you receive test referrals from consultants, commit to a reporting deadline, ' +
      'upload results, bill for the tests, and settle with the platform. Your menu contains: Dashboard, ' +
      'Inbox, Referrals, Test catalogue, Settlements, Team, and Profile settings.',
    );

    b.h(2, 'Your Dashboard');

    b.p(
      'The dashboard summarises your referral counts by status and links to the screens where work is ' +
      'waiting.',
    );

    b.h(2, 'Responding to Referrals — The Inbox');

    b.p(
      'Inbox holds incoming referrals awaiting your response. Each shows the patient, the referring ' +
      'consultant, and the tests requested.',
    );

    b.bullets([
      'Accept — you must enter the expected report date and time before accepting. This commitment is shown to the consultant and the patient, so give a realistic turnaround.',
      'Reject — give a reason, for example a test you do not perform. The consultant can then re-refer the case to another laboratory.',
    ]);

    b.h(2, 'Processing Referrals and Billing');

    b.p(
      'Referrals is where accepted work is completed. Open a referral to manage it.',
    );

    b.bullets([
      'Upload reports — attach the result files. The consultant is notified as soon as a report is uploaded.',
      'Set the bill — enter the amount for each test. Prices are filled in automatically from your test catalogue where they match, and you can adjust them per referral.',
      'Finalise — once reports are uploaded and the bill is correct, finalise the referral. This closes the case and makes it available for settlement.',
    ]);

    b.note(
      'Test descriptions cannot be changed',
      'You can price the tests but not alter which tests were ordered — the consultant\'s order is fixed ' +
      'for clinical safety. If the order is wrong, reject the referral with a reason and ask the ' +
      'consultant to raise a corrected one.',
      'warn',
    );

    b.table(
      ['Status', 'Meaning'],
      [
        ['Pending', 'Awaiting your accept or reject decision.'],
        ['Accepted', 'You have committed to a report date; samples in process.'],
        ['Reported', 'Report files uploaded and available to the consultant.'],
        ['Closed', 'Finalised and billed; eligible for settlement.'],
        ['Rejected', 'Declined with a reason; the consultant may re-refer elsewhere.'],
      ],
      [1, 4],
    );

    b.h(2, 'Test Catalogue');

    b.p(
      'Test catalogue is your price list: the test name, its price, and its turnaround time in hours. ' +
      'Keep it accurate — it drives the prices offered to consultants and pre-fills your billing, which ' +
      'saves time on every referral.',
    );

    b.h(2, 'Settlements');

    b.p(
      'Settlements mirrors the hospital process: bundle closed referrals into a billing period, pay the ' +
      'platform, upload your receipt, and wait for verification. A settlement moves through five stages.',
    );

    b.table(
      ['Stage', 'Meaning'],
      [
        ['Pending payment', 'The settlement has been created; payment to the platform is due.'],
        ['Pending admin verification', 'Your receipt has been uploaded and is awaiting the administrator\'s check.'],
        ['Paid, pending consultant payout', 'Your payment is verified; the platform is releasing consultant commissions.'],
        ['Paid, pending consultant verification', 'Payouts have been sent; consultants are confirming receipt.'],
        ['Completed', 'The settlement is closed. No further action is required.'],
      ],
      [1.4, 3],
    );

    b.h(2, 'Managing Your Team');

    b.p(
      'Team works exactly as it does for hospitals: create logins for your laboratory staff so that ' +
      'several people can process the inbox and upload reports.',
    );

    // ---------------------------------------------------------------- 6
    b.h(1, 'Administrator Guide');

    b.p(
      'As a platform administrator you control who joins the platform, the commercial terms that apply ' +
      'to them, how referrals are matched, and the movement of money. This chapter covers each area of ' +
      'the admin console in the order you will normally use it.',
    );

    b.h(2, 'Overview');

    b.p(
      'Overview is the platform control tower: headline figures across all roles, a chart of activity, ' +
      'a bed-availability snapshot across all hospitals, and the most recent audit entries. Use the ' +
      'refresh control to pull the latest figures on demand.',
    );

    b.h(2, 'Approving Registrations');

    b.p(
      'Approvals is the gate to the platform and should be checked daily. Every consultant, hospital, ' +
      'and laboratory application waits here until you act on it.',
    );

    b.bullets([
      'Open an application to see the submitted details and the uploaded verification documents.',
      'Check each document is legible and that the registration number matches the certificate — PMDC for consultants, and the registration or licence certificate for hospitals and laboratories.',
      'Approve to activate the account. The applicant can then sign in immediately.',
      'Reject with a clear reason if documents are missing or unreadable. The reason is sent to the applicant so they know what to correct.',
    ], { ordered: true });

    b.note(
      'Approval is a verification decision, not a formality',
      'Approving an account admits a clinical organisation onto a platform handling patient data and ' +
      'money. Do not approve an application whose documents you cannot read or whose registration ' +
      'number you cannot match to the certificate provided.',
      'warn',
    );

    b.h(2, 'Managing Consultants, Hospitals, and Laboratories');

    b.p(
      'The Consultants, Hospitals, and Laboratory screens are the registries for each role. All three ' +
      'share the same pattern: a searchable list with status badges, and a detail view for each record.',
    );

    b.table(
      ['Action', 'Available on', 'Notes'],
      [
        ['Edit profile', 'All three registries', 'Correct details on behalf of a user, for example a mistyped registration number.'],
        ['Change status', 'All three registries', 'Set an account to active, pending, or suspended. Suspending blocks sign-in without deleting any history.'],
        ['Reset password', 'All three registries', 'Set a new password for a user who cannot access their account. Communicate it to them securely.'],
        ['Set commercial terms', 'Consultants, hospitals, laboratories', 'Configure the commission or platform charge that applies to that party. See section 6.3.'],
        ['View patients', 'Consultants and hospitals', 'The list of patients associated with that party.'],
        ['Manage doctors', 'Hospitals', 'Add or remove doctors on the hospital\'s behalf.'],
        ['Export PDF', 'All three registries', 'Download a profile summary for your records.'],
        ['Delete account', 'All three registries', 'Permanent. Use suspension instead unless removal is genuinely required.'],
      ],
      [1.3, 1.5, 3.2],
    );

    b.h(2, 'Commercial Terms');

    b.p(
      'CareBridge supports platform-wide defaults with per-party overrides, so a standard arrangement ' +
      'can be varied for individual hospitals, laboratories, or consultants without affecting anyone ' +
      'else.',
    );

    b.bullets([
      'Platform defaults — set in Settings: the default hospital deduction percentage, the default consultant commission percentage, and the wallet thresholds.',
      'Per-hospital and per-laboratory terms — set on that organisation\'s record: a percentage of the bill, or a fixed charge per case.',
      'Per-consultant overrides — set on a hospital or laboratory record to vary the terms for one specific consultant referring to that organisation.',
    ]);

    b.note(
      'Overrides take precedence over defaults',
      'Where an override exists it is used instead of the platform default. Review overrides before ' +
      'changing a default, or the change may not have the effect you expect.',
    );

    b.h(2, 'Configuring the Matching Engine');

    b.p(
      'Scoring controls how hospitals are ranked in consultants\' recommendations. Six factors are ' +
      'weighted, and the weights must total exactly 100 — the screen will not save otherwise.',
    );

    b.table(
      ['Factor', 'What it rewards'],
      [
        ['Specialty match', 'Hospitals whose departments match the patient\'s clinical need.'],
        ['Bed availability', 'Hospitals with free beds in the ward type the referral requires.'],
        ['Distance', 'Hospitals close to the patient\'s location.'],
        ['Cost fit', 'Hospitals whose charges suit the referral.'],
        ['SLA history', 'Hospitals with a strong record of responding within the deadline.'],
        ['Preference', 'Hospitals the referring consultant has favourited or used before.'],
      ],
      [1.2, 3.8],
    );

    b.note(
      'Change weights deliberately',
      'These weights shape every recommendation on the platform. Adjust one factor at a time and observe ' +
      'the effect on referral distribution before making further changes.',
      'warn',
    );

    b.h(2, 'The Department Catalogue');

    b.p(
      'Departments defines the department list and the keywords that map symptoms to each department. ' +
      'When a consultant types symptoms, these keywords are what allow CareBridge to suggest the right ' +
      'department. Adding good keywords to this catalogue directly improves referral accuracy.',
    );

    b.h(2, 'Overseeing Referrals');

    b.p(
      'Referrals gives you visibility of, and the ability to correct, every referral on the platform. ' +
      'You can edit patient demographics, urgency, symptoms, department, diagnosis, status, and ' +
      'admission details including room, bed, and treating doctor.',
    );

    b.note(
      'Deletion is permanent and deliberately difficult',
      'Deleting a referral requires three confirmations, ending with typing the patient\'s name. There is ' +
      'no undo, and the referral\'s financial history goes with it. Correct a referral by editing it ' +
      'wherever possible.',
      'danger',
    );

    b.h(2, 'Verifying Settlements and Releasing Payouts');

    b.p(
      'Settlements is where money movement is authorised. Hospitals and laboratories submit payment ' +
      'receipts here for your verification, and you release the resulting consultant payouts.',
    );

    b.bullets([
      'Open a settlement awaiting verification and review the uploaded receipt against the amount due.',
      'Verify the receipt if it is correct and complete, or reject it with a reason if it is not — the organisation can then upload a corrected receipt.',
      'Once verified, pay the consultants their commission by your agreed method.',
      'Upload the payout receipt for each consultant against the settlement.',
      'The consultants confirm receipt in their own portal, which closes the settlement.',
    ], { ordered: true });

    b.p(
      'Payouts is a read-only record of consultant commission accruals and their status — pending, paid, ' +
      'or failed. Use it to investigate a consultant\'s query about a specific amount.',
    );

    b.h(2, 'Bed Oversight');

    b.p(
      'Beds shows the bed inventory of every hospital on one screen, refreshed automatically. You can ' +
      'correct any hospital\'s ward counts directly — useful when a hospital reports a discrepancy that ' +
      'is affecting its recommendations.',
    );

    b.h(2, 'Platform Settings');

    b.p(
      'Settings holds two groups of configuration.',
    );

    b.bullets([
      'Financial defaults — the default hospital deduction percentage, the default consultant commission percentage, the wallet threshold at which a consultant balance becomes withdrawable, and the initial hold retained on release. A live estimator shows how a sample bill would split under the current values.',
      'Platform branding — the platform name, logo, favicon, and the primary and accent colours. Changes apply across the platform immediately for all users who do not have their own hospital branding.',
    ]);

    b.h(2, 'The Audit Log');

    b.p(
      'Audit records administrative actions across the platform — who did what, to which record, and ' +
      'when. Search across action, record type, and administrator, and export the log for compliance ' +
      'or investigation purposes. The audit log is the platform\'s accountability record and should be ' +
      'reviewed periodically.',
    );

    b.h(2, 'The Admin Team');

    b.p(
      'Admins manages the platform administrator accounts themselves. Add administrators sparingly — ' +
      'every administrator has full access to patient data, financial records, and platform ' +
      'configuration.',
    );

    // ---------------------------------------------------------------- 7
    b.h(1, 'Troubleshooting');

    b.h(2, 'Common Questions');

    b.table(
      ['Symptom', 'Likely cause and resolution'],
      [
        ['Cannot sign in; told the account is pending',
          'The registration has not yet been approved. Allow one to two working days, then contact the platform administrator.'],
        ['Cannot sign in; asked to verify email',
          'The email verification code was never entered. Use the resend link on the login page and enter the fresh six-digit code.'],
        ['Verification email never arrived',
          'Check the spam or junk folder first. If it is not there, wait for the resend cooldown to finish and request another. Confirm the email address on the account is spelled correctly.'],
        ['Password reset link does not work',
          'Reset links expire and can be used only once. Request a new one from Forgot password.'],
        ['Returned to the login page unexpectedly',
          'The session expired after a period of inactivity. Sign in again; nothing that was saved is lost.'],
        ['No hospitals appear in the recommendations',
          'Confirm the patient area was entered and Find best hospitals was used. Very specific ward requirements can also narrow the results — try a broader ward type.'],
        ['A referral cannot be edited',
          'Referrals can only be edited while pending, accepted, or rejected. Once a patient is admitted the record is locked. Ask a platform administrator to make a correction.'],
        ['Dashboard figures look out of date',
          'Screens update live, but a dropped connection can delay this. Refresh the page in the browser. If figures are still wrong, contact support.'],
        ['A document cannot be re-uploaded',
          'Documents already verified by an administrator are locked. Contact the platform administrator to have the document unlocked or replaced.'],
        ['A file upload fails',
          'Check the file size and that it is a supported type (PDF or image). Very large scans should be reduced in resolution before uploading.'],
      ],
      [1.5, 3],
    );

    b.h(2, 'Getting Help');

    b.p(
      'If a problem is not covered above, contact the CareBridge platform administrator. To help them ' +
      'resolve it quickly, include: your role and registered email address, the screen you were on, the ' +
      'referral code if the issue concerns a specific referral, what you expected to happen, what ' +
      'actually happened, and the exact wording of any error message.',
    );
  },
};
