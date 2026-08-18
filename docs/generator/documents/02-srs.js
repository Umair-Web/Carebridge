const { meta } = require('../common');

module.exports = {
  meta: meta(
    'CB-SRS-2026-002',
    'Software Requirements Specification',
    'Functional and non-functional requirements for the CareBridge platform, each traced to its implementation status',
  ),

  body(b) {
    // ---------------------------------------------------------------- 1
    b.h(1, 'Introduction');

    b.h(2, 'Purpose');

    b.p(
      'This specification records the requirements that the CareBridge platform was built to satisfy, ' +
      'and states the implementation status of each. It serves two purposes at handover: it is the ' +
      'reference against which the delivered system can be verified, and it is the baseline from which ' +
      'any future phase of work is specified.',
    );

    b.p(
      'Every requirement carries a unique identifier and a status. Statuses are used strictly: ' +
      'Implemented means present and operational in the delivered system; Partial means present but ' +
      'dependent on a client action or configuration to become fully operational; Not implemented means ' +
      'absent from the delivered system.',
    );

    b.h(2, 'Scope');

    b.p(
      'CareBridge is a web-based platform that manages the referral of patients from independent ' +
      'consultants to hospitals and diagnostic laboratories, and the commercial settlement that follows ' +
      'treatment. It covers the full path from a consultant creating a referral, through hospital ' +
      'acceptance, admission, treatment, and billing, to the division of the resulting revenue between ' +
      'the facility, the consultant, and the platform operator.',
    );

    b.p(
      'The system does not provide clinical records management, does not prescribe or record ' +
      'treatment beyond free-text clinical notes, and is not a hospital information system. It records ' +
      'the referral relationship and the money that flows from it.',
    );

    b.h(2, 'Definitions');

    b.table(
      ['Term', 'Definition'],
      [
        ['Consultant', 'A referring doctor registered on the platform, who creates referrals and earns commission on them.'],
        ['Facility', 'A hospital or laboratory that receives referrals.'],
        ['Referral', 'A structured request from a consultant to a facility to receive a named patient, carrying clinical and demographic detail.'],
        ['Admission', 'The record created when a hospital admits a referred patient, and against which the case is eventually billed.'],
        ['Response deadline', 'The time by which a facility must accept or reject a referral, determined by the referral\'s clinical urgency.'],
        ['Escalation', 'Automatic reassignment of a referral to another facility when the response deadline passes without a decision.'],
        ['Platform charge', 'The amount the platform operator retains from a billed case.'],
        ['Consultant commission', 'The amount payable to the referring consultant from a billed case.'],
        ['Settlement', 'A periodic reconciliation in which a facility pays the platform for a set of billed cases and consultant payouts are released.'],
        ['Paisa', 'The subunit of the Pakistani Rupee. One rupee equals 100 paisa. All monetary values are stored as whole paisa.'],
      ],
      [1, 4],
    );

    b.h(2, 'Requirement Identifier Scheme');

    b.table(
      ['Prefix', 'Area'],
      [
        ['FR-AUTH', 'Identity, registration, and access control'],
        ['FR-REF', 'Referral creation and matching'],
        ['FR-LIFE', 'Referral lifecycle and escalation'],
        ['FR-ADM', 'Admissions and hospital operations'],
        ['FR-LAB', 'Laboratory module'],
        ['FR-FIN', 'Commission and settlement'],
        ['FR-PLAT', 'Platform administration'],
        ['FR-NOTE', 'Notifications and real-time updates'],
        ['FR-DOC', 'Documents, exports, and payments'],
        ['NFR', 'Non-functional requirements'],
      ],
      [1, 4],
    );

    // ---------------------------------------------------------------- 2
    b.h(1, 'Overall Description');

    b.h(2, 'Product Perspective');

    b.p(
      'CareBridge is a self-contained web application with a browser-based client and a server-side ' +
      'API. It depends on four external services: a document database, a file storage service, a ' +
      'transactional email service, and — for optional features — a messaging service and a payment ' +
      'gateway. It does not integrate with hospital information systems, laboratory information ' +
      'systems, or national health registries; verification of professional registration numbers is a ' +
      'manual administrative step supported by document upload.',
    );

    b.h(2, 'User Classes');

    b.table(
      ['User class', 'Characteristics', 'Technical proficiency'],
      [
        ['Consultant', 'Independent referring doctors. Use the system in short bursts between patients, frequently on a mobile device.', 'Low to moderate. The referral flow is guided step by step for this reason.'],
        ['Hospital staff', 'Administrative and reception staff working the referral inbox continuously during shifts, plus managers using billing and settlement screens.', 'Moderate. Multiple staff share one hospital account tree via sub-accounts.'],
        ['Laboratory staff', 'Reception and reporting staff processing test referrals and uploading results.', 'Moderate.'],
        ['Platform administrator', 'CareBridge operations staff performing approvals, configuration, and financial verification.', 'High. This class has unrestricted access and configures behaviour affecting all other users.'],
      ],
      [1, 3, 2],
    );

    b.h(2, 'Operating Environment');

    b.bullets([
      'Client — any current desktop or mobile browser (Chrome, Edge, Firefox, Safari). No installation is required. The interface adapts to small screens.',
      'Server — Node.js 20 or later, running on a managed hosting platform.',
      'Database — MongoDB, with geospatial indexing enabled for distance-based matching.',
      'Network — the client requires an internet connection; real-time updates require an outbound WebSocket connection to be permitted by the user\'s network.',
    ]);

    b.h(2, 'Design and Implementation Constraints');

    b.bullets([
      'Monetary precision — all money is stored as whole paisa in integer fields. No monetary value may be held as a floating-point number.',
      'Single commission engine — every calculation that splits a bill must use the shared commission module. The design record identifies duplicated bill-splitting arithmetic as the principal historical defect risk in this system.',
      'Historical reproducibility — the commercial terms applied to a case must be recorded on the resulting payout record, so that figures remain reproducible after terms change.',
      'Backwards compatibility of commercial terms — the additive commission model was introduced after the platform was in use. Existing parties default to the original nested model and are opted in individually.',
      'Locale — telephone numbers and identity numbers are validated against Pakistani formats. Times shown in messages are rendered in Pakistan Standard Time. Currency is the Pakistani Rupee.',
    ]);

    b.h(2, 'Assumptions and Dependencies');

    b.bullets([
      'Professional registration numbers are verified by an administrator against uploaded certificates. The system does not verify them against an external registry.',
      'Facilities maintain their own bed inventory and test catalogue accurately. The platform cannot detect a stale bed count, and matching quality depends directly on this.',
      'Settlement is receipt-based. Payment between the parties occurs outside the platform and is evidenced by uploaded receipts verified by an administrator.',
      'Email delivery depends on the third-party provider. Registration cannot complete if verification email delivery fails.',
    ]);

    // ---------------------------------------------------------------- 3
    b.h(1, 'Functional Requirements — Identity and Access');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['FR-AUTH-01', 'The system shall allow consultants, hospitals, and laboratories to register themselves through role-specific registration forms. Administrator accounts shall not be creatable through public registration.', 'Implemented'],
        ['FR-AUTH-02', 'Consultant registration shall capture full name, email, mobile number, password, professional registration number, national identity number, specialty, clinic name and address, and clinic geographic location.', 'Implemented'],
        ['FR-AUTH-03', 'Hospital registration shall capture hospital name, contact details, password, registration number, representative identity number, address, geographic location, operating departments, and initial bed inventory by ward type.', 'Implemented'],
        ['FR-AUTH-04', 'Laboratory registration shall capture laboratory name, contact details, password, registration number, representative identity number, city, area, address, geographic location, and an initial test catalogue with prices and turnaround times.', 'Implemented'],
        ['FR-AUTH-05', 'The system shall require applicants to upload verification documents — a professional or organisational registration certificate and identity documents — before an application can be submitted.', 'Implemented'],
        ['FR-AUTH-06', 'The system shall require the applicant to view and accept the standard operating procedure and privacy policy before submission.', 'Implemented'],
        ['FR-AUTH-07', 'The system shall verify the applicant\'s email address by a six-digit one-time code, and shall permit the code to be resent subject to a cooldown period.', 'Implemented'],
        ['FR-AUTH-08', 'The system shall create every new account in a pending state and shall prevent sign-in until an administrator activates it.', 'Implemented'],
        ['FR-AUTH-09', 'The system shall allow an administrator to approve an application, or reject it with a reason that is communicated to the applicant.', 'Implemented'],
        ['FR-AUTH-10', 'The system shall notify all administrators when a new registration is submitted.', 'Implemented'],
        ['FR-AUTH-11', 'The system shall authenticate users by email and password, and shall reject sign-in for accounts that are pending, suspended, or whose email is unverified, stating which condition applies.', 'Implemented'],
        ['FR-AUTH-12', 'The system shall store passwords only as salted cryptographic hashes and shall require a minimum length of eight characters.', 'Implemented'],
        ['FR-AUTH-13', 'The system shall issue a short-lived access credential and a longer-lived renewal credential, and shall renew the session transparently so that a user working continuously is not interrupted.', 'Implemented'],
        ['FR-AUTH-14', 'The system shall refuse to renew a session for an account that is no longer active.', 'Implemented'],
        ['FR-AUTH-15', 'The system shall allow a user to request a password reset by email, using a single-use link that expires after a limited period.', 'Implemented'],
        ['FR-AUTH-16', 'The system shall not disclose whether an email address is registered when a password reset is requested.', 'Implemented'],
        ['FR-AUTH-17', 'The system shall allow an administrator to set a new password for any user.', 'Implemented'],
        ['FR-AUTH-18', 'The system shall notify a user when their password is changed and when their account is signed into.', 'Implemented'],
        ['FR-AUTH-19', 'The system shall restrict every screen and every endpoint by role, and shall redirect a user attempting to reach a screen outside their role.', 'Implemented'],
        ['FR-AUTH-20', 'The system shall allow hospitals, laboratories, and the platform to create team member accounts that sign in to the same portal as their parent organisation.', 'Implemented'],
        ['FR-AUTH-21', 'The system shall prevent a team member from removing an account that created their own, directly or indirectly.', 'Implemented'],
        ['FR-AUTH-22', 'The system shall allow an administrator to suspend and reactivate an account without deleting its history.', 'Implemented'],
        ['FR-AUTH-23', 'The system shall allow a user to update their own name, mobile number, password, and verification documents, and shall prevent replacement of documents that an administrator has verified.', 'Implemented'],
      ],
      [0.85, 4.4, 0.9],
    );

    // ---------------------------------------------------------------- 4
    b.h(1, 'Functional Requirements — Referral Creation and Matching');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['FR-REF-01', 'The system shall provide consultants with a guided multi-step referral intake covering patient details, clinical assessment, location preferences, and facility selection, allowing free movement between steps without loss of entered data.', 'Implemented'],
        ['FR-REF-02', 'The system shall capture patient name, national identity number, guardian name and relation, date of birth or age, gender, and contact number.', 'Implemented'],
        ['FR-REF-03', 'The system shall accept patient age expressed in years, months, or days and shall derive a date of birth from it, so that infants and neonates can be recorded accurately.', 'Implemented'],
        ['FR-REF-04', 'The system shall encrypt the patient national identity number before storage and shall decrypt it only when serving an authorised request.', 'Implemented'],
        ['FR-REF-05', 'The system shall capture presenting symptoms as free text, a clinical summary, and optional file attachments.', 'Implemented'],
        ['FR-REF-06', 'The system shall suggest a clinical department from the entered symptoms, using a keyword catalogue maintained by administrators.', 'Implemented'],
        ['FR-REF-07', 'The system shall require a clinical urgency of emergency, urgent, or routine on every referral.', 'Implemented'],
        ['FR-REF-08', 'The system shall capture the ward type required by the patient.', 'Implemented'],
        ['FR-REF-09', 'The system shall rank candidate hospitals for a referral by a weighted score across department match, bed availability, distance from the patient, cost fit, response-time history, and consultant preference.', 'Implemented'],
        ['FR-REF-10', 'The system shall exclude from the ranking any hospital that does not operate the required department, or that has no available bed in the required ward type.', 'Implemented'],
        ['FR-REF-11', 'The system shall treat intensive care as the required ward for emergency referrals and a general ward otherwise, when applying the bed availability filter.', 'Implemented'],
        ['FR-REF-12', 'The system shall calculate distance between the patient and each hospital using geographic coordinates, and shall award no distance score beyond a 30 kilometre horizon.', 'Implemented'],
        ['FR-REF-13', 'The system shall present, for each recommended hospital, the reasons for its ranking.', 'Implemented'],
        ['FR-REF-14', 'The system shall allow the consultant to select a specific department and a named doctor at the receiving hospital.', 'Implemented'],
        ['FR-REF-15', 'The system shall allow a consultant to submit a referral to more than one hospital, each tracked independently.', 'Implemented'],
        ['FR-REF-16', 'The system shall allow a consultant to mark hospitals as favourites, and shall weight favourited hospitals more highly in that consultant\'s future recommendations.', 'Implemented'],
        ['FR-REF-17', 'The system shall record the number of referrals a consultant has previously sent to each hospital and shall use this history to weight future recommendations.', 'Implemented'],
        ['FR-REF-18', 'The system shall allocate a unique sequential referral code to every referral, in a form that includes the year, and shall allocate codes atomically so that no two referrals can share one.', 'Implemented'],
        ['FR-REF-19', 'The system shall record a snapshot of the scoring outcome on the referral, so that the basis of a recommendation remains available after weights change.', 'Implemented'],
      ],
      [0.85, 4.4, 0.9],
    );

    // ---------------------------------------------------------------- 5
    b.h(1, 'Functional Requirements — Referral Lifecycle');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['FR-LIFE-01', 'The system shall present each hospital with an inbox of referrals awaiting its response, showing patient, consultant, clinical detail, urgency, and time remaining before the response deadline.', 'Implemented'],
        ['FR-LIFE-02', 'The system shall display the time remaining as a live countdown and shall indicate clearly when a referral is overdue.', 'Implemented'],
        ['FR-LIFE-03', 'The system shall set a response deadline on every referral according to urgency: 15 minutes for emergency, 2 hours for urgent, and 24 hours for routine.', 'Implemented'],
        ['FR-LIFE-04', 'The system shall provide a dedicated triage view showing only unanswered emergency referrals.', 'Implemented'],
        ['FR-LIFE-05', 'The system shall require a hospital to assign a department when accepting a referral.', 'Implemented'],
        ['FR-LIFE-06', 'The system shall require a hospital to give a reason when rejecting a referral, and shall make that reason visible to the consultant.', 'Implemented'],
        ['FR-LIFE-07', 'The system shall check every minute for referrals whose response deadline has passed without a decision.', 'Implemented'],
        ['FR-LIFE-08', 'The system shall automatically reassign an overdue referral to the next hospital in its ranked list, applying the consultant\'s department and doctor preference for that hospital, and setting a fresh response deadline.', 'Implemented'],
        ['FR-LIFE-09', 'The system shall, for an overdue emergency referral whose ranked list is exhausted, reassign it to the nearest active hospital within 20 kilometres that has not already been tried.', 'Implemented'],
        ['FR-LIFE-10', 'The system shall reject a referral automatically, with an explanatory reason, when its deadline passes and no further hospital is available.', 'Implemented'],
        ['FR-LIFE-11', 'The system shall degrade the recorded performance of a hospital that allows a referral to escalate, and shall reflect that degradation in the hospital\'s future ranking.', 'Implemented'],
        ['FR-LIFE-12', 'The system shall notify the consultant and both the previous and the new hospital when a referral escalates.', 'Implemented'],
        ['FR-LIFE-13', 'The system shall maintain a clinical notes timeline on each referral, distinguishing nursing notes from consultant notes, and shall record the author and time of each note.', 'Implemented'],
        ['FR-LIFE-14', 'The system shall make the clinical notes timeline visible to the referring consultant.', 'Implemented'],
        ['FR-LIFE-15', 'The system shall maintain the referral status through pending, accepted, rejected, admitted, and closed.', 'Implemented'],
        ['FR-LIFE-16', 'The system shall allow a consultant to edit a referral while it is pending, accepted, or rejected, and shall prevent editing once the patient is admitted.', 'Implemented'],
      ],
      [0.85, 4.4, 0.9],
    );

    // ---------------------------------------------------------------- 6
    b.h(1, 'Functional Requirements — Admissions and Hospital Operations');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['FR-ADM-01', 'The system shall allow a hospital to admit an accepted referral, recording ward, room, bed, admitting department, and treating doctor, all of which shall be mandatory.', 'Implemented'],
        ['FR-ADM-02', 'The system shall create exactly one admission record per referral.', 'Implemented'],
        ['FR-ADM-03', 'The system shall allow a hospital to bill a completed case as a set of description-and-amount service lines, and shall total them automatically.', 'Implemented'],
        ['FR-ADM-04', 'The system shall capture the payment method and reference on billing, and shall allow the patient bill document to be attached.', 'Implemented'],
        ['FR-ADM-05', 'The system shall, on billing a case, close the referral, compute the commercial split, and create a consultant commission accrual.', 'Implemented'],
        ['FR-ADM-06', 'The system shall ensure that billing a case a second time has no additional financial effect.', 'Implemented'],
        ['FR-ADM-07', 'The system shall maintain a bed inventory for each hospital across ward types, recording total, occupied, and available beds.', 'Implemented'],
        ['FR-ADM-08', 'The system shall allow a hospital to adjust bed counts, both incrementally and by direct entry.', 'Implemented'],
        ['FR-ADM-09', 'The system shall allow a hospital to maintain the list of departments it operates, and shall use that list to determine eligibility for referrals.', 'Implemented'],
        ['FR-ADM-10', 'The system shall allow a hospital to maintain a register of its doctors with specialty, registration number, consultation fee, contact details, and an availability flag.', 'Implemented'],
        ['FR-ADM-11', 'The system shall provide a hospital with a financial ledger of billed cases showing the amount billed, the platform charge, and the hospital\'s net position, searchable and exportable.', 'Implemented'],
        ['FR-ADM-12', 'The system shall allow a hospital to apply its own logo and primary colour to the portal as seen by its own users.', 'Implemented'],
      ],
      [0.85, 4.4, 0.9],
    );

    // ---------------------------------------------------------------- 7
    b.h(1, 'Functional Requirements — Laboratory Module');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['FR-LAB-01', 'The system shall allow a consultant to create a laboratory referral carrying patient details, an ordered list of tests, clinical notes, and attachments.', 'Implemented'],
        ['FR-LAB-02', 'The system shall allocate a unique sequential code to every laboratory referral, distinct in form from hospital referral codes.', 'Implemented'],
        ['FR-LAB-03', 'The system shall allow a consultant to apply a discount to a laboratory referral, capped at a maximum set for that consultant.', 'Implemented'],
        ['FR-LAB-04', 'The system shall suggest laboratories for a referral and shall also allow direct selection by name.', 'Implemented'],
        ['FR-LAB-05', 'The system shall require a laboratory to commit an expected report date and time when accepting a referral.', 'Implemented'],
        ['FR-LAB-06', 'The system shall require a reason when a laboratory rejects a referral.', 'Implemented'],
        ['FR-LAB-07', 'The system shall allow a consultant to re-refer a rejected laboratory referral to a different laboratory without re-entering patient details.', 'Implemented'],
        ['FR-LAB-08', 'The system shall allow a laboratory to upload report files against a referral and shall notify the consultant on upload.', 'Implemented'],
        ['FR-LAB-09', 'The system shall allow a laboratory to price each ordered test, pre-filling prices from its own catalogue where the test name matches.', 'Implemented'],
        ['FR-LAB-10', 'The system shall prevent a laboratory from altering which tests were ordered by the consultant.', 'Implemented'],
        ['FR-LAB-11', 'The system shall compute a laboratory bill as the gross of the priced tests less the applicable discount.', 'Implemented'],
        ['FR-LAB-12', 'The system shall, on finalisation of a laboratory referral, close it, compute the commercial split, and create a consultant commission accrual.', 'Implemented'],
        ['FR-LAB-13', 'The system shall maintain the laboratory referral status through pending, accepted, reported, closed, and rejected.', 'Implemented'],
        ['FR-LAB-14', 'The system shall allow a laboratory to maintain a test catalogue of test name, price, and turnaround time.', 'Implemented'],
      ],
      [0.85, 4.4, 0.9],
    );

    // ---------------------------------------------------------------- 8
    b.h(1, 'Functional Requirements — Commission and Settlement');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['FR-FIN-01', 'The system shall compute every division of a patient bill through a single shared commission module, so that no calculation path can diverge from another.', 'Implemented'],
        ['FR-FIN-02', 'The system shall support a nested commission model in which the platform takes a percentage of the bill and the consultant takes a percentage of that deduction.', 'Implemented'],
        ['FR-FIN-03', 'The system shall support an additive commission model in which the consultant commission and the platform charge are computed independently of one another and summed to give the facility\'s liability.', 'Implemented'],
        ['FR-FIN-04', 'The system shall allow the consultant commission and the platform charge each to be expressed as a percentage or as a fixed amount, independently of the other.', 'Implemented'],
        ['FR-FIN-05', 'The system shall apply fixed hospital charges per referral, and fixed laboratory charges per test.', 'Implemented'],
        ['FR-FIN-06', 'The system shall guarantee, under every model and combination, that the total deducted from a bill equals the consultant commission plus the platform charge.', 'Implemented'],
        ['FR-FIN-07', 'The system shall never reduce the platform charge to subsidise a consultant commission.', 'Implemented'],
        ['FR-FIN-08', 'The system shall resolve applicable commercial terms in the order: consultant-facility override, then facility terms, then platform defaults.', 'Implemented'],
        ['FR-FIN-09', 'The system shall allow a distinct platform charge to be agreed between an individual consultant and an individual facility.', 'Implemented'],
        ['FR-FIN-10', 'The system shall record on every commission accrual the model, type, rates, and amounts applied, so that historical figures remain reproducible after terms change.', 'Implemented'],
        ['FR-FIN-11', 'The system shall default every existing party to the nested model, so that adoption of the additive model changes no party\'s terms until an administrator opts them in.', 'Implemented'],
        ['FR-FIN-12', 'The system shall allow a facility to assemble a settlement from billed cases within a stated period, attach a summary document, and add notes.', 'Implemented'],
        ['FR-FIN-13', 'The system shall support settlements containing consultants on different commission models, types, and rates, totalling them correctly.', 'Implemented'],
        ['FR-FIN-14', 'The system shall progress a settlement through pending payment, pending administrator verification, paid pending consultant payout, paid pending consultant verification, and completed.', 'Implemented'],
        ['FR-FIN-15', 'The system shall allow a facility to upload a payment receipt against a settlement.', 'Implemented'],
        ['FR-FIN-16', 'The system shall allow an administrator to verify a receipt, or reject it with a reason that the facility can see and act on.', 'Implemented'],
        ['FR-FIN-17', 'The system shall allow an administrator to record a payout to each consultant on a settlement, with a receipt.', 'Implemented'],
        ['FR-FIN-18', 'The system shall require the consultant to confirm receipt of a payout, and shall complete the settlement only when all payouts are confirmed.', 'Implemented'],
        ['FR-FIN-19', 'The system shall provide a consultant with an earnings view showing wallet balance, commission by referral, and payout history, exportable as a document.', 'Implemented'],
        ['FR-FIN-20', 'The system shall allow a consultant to request a withdrawal subject to a minimum amount and their available balance.', 'Implemented'],
        ['FR-FIN-21', 'The system shall store every monetary value as a whole number of paisa.', 'Implemented'],
        ['FR-FIN-22', 'The system shall provide the same settlement cycle for laboratories as for hospitals.', 'Implemented'],
      ],
      [0.85, 4.4, 0.9],
    );

    b.note(
      'On the wallet threshold and initial hold',
      'The platform settings include a wallet threshold and an initial hold, configurable by an ' +
      'administrator and defaulting to PKR 10,000 and PKR 9,500 respectively. These belong to an ' +
      'earlier automatic wallet-crediting design that has been superseded by the receipt-based ' +
      'settlement cycle described in FR-FIN-12 to FR-FIN-18. The settings remain configurable and the ' +
      'superseded module remains in the codebase but is not connected to the current billing flow. ' +
      'Removal is recommended in the Maintenance and Support Guide.',
      'warn',
    );

    // ---------------------------------------------------------------- 9
    b.h(1, 'Functional Requirements — Platform Administration');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['FR-PLAT-01', 'The system shall present administrators with a queue of pending registrations, including the submitted verification documents.', 'Implemented'],
        ['FR-PLAT-02', 'The system shall provide registries of consultants, hospitals, and laboratories, searchable and filterable by account status.', 'Implemented'],
        ['FR-PLAT-03', 'The system shall allow an administrator to correct any party\'s profile details.', 'Implemented'],
        ['FR-PLAT-04', 'The system shall allow an administrator to configure commercial terms at platform, facility, and consultant-facility level.', 'Implemented'],
        ['FR-PLAT-05', 'The system shall allow an administrator to configure the six matching-engine weights, and shall reject any configuration whose weights do not total exactly 100.', 'Implemented'],
        ['FR-PLAT-06', 'The system shall allow an administrator to maintain the department catalogue and the symptom keywords that map to each department.', 'Implemented'],
        ['FR-PLAT-07', 'The system shall allow an administrator to view and correct any referral, including its admission details.', 'Implemented'],
        ['FR-PLAT-08', 'The system shall require multiple explicit confirmations, including entry of the patient name, before permanently deleting a referral.', 'Implemented'],
        ['FR-PLAT-09', 'The system shall present bed inventory across all hospitals and allow an administrator to correct it.', 'Implemented'],
        ['FR-PLAT-10', 'The system shall allow an administrator to configure platform financial defaults.', 'Implemented'],
        ['FR-PLAT-11', 'The system shall allow an administrator to configure platform branding — name, logo, favicon, and colour scheme — without redeployment.', 'Implemented'],
        ['FR-PLAT-12', 'The system shall record administrative actions in an audit log capturing the acting user, the action, the affected record, the network address, and the client used.', 'Implemented'],
        ['FR-PLAT-13', 'The system shall allow the audit log to be searched and exported.', 'Implemented'],
        ['FR-PLAT-14', 'The system shall provide administrators with platform-wide analytics covering referral volume, activity, and bed availability.', 'Implemented'],
        ['FR-PLAT-15', 'The system shall allow an administrator to manage the administrator team.', 'Implemented'],
      ],
      [0.85, 4.4, 0.9],
    );

    // ---------------------------------------------------------------- 10
    b.h(1, 'Functional Requirements — Notifications, Documents, and Payments');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['FR-NOTE-01', 'The system shall raise notifications for registration, referral, admission, billing, settlement, payout, and account events.', 'Implemented'],
        ['FR-NOTE-02', 'The system shall deliver notifications in the application, with an unread counter, and shall deliver them without the user refreshing the page.', 'Implemented'],
        ['FR-NOTE-03', 'The system shall deliver notifications by email.', 'Implemented'],
        ['FR-NOTE-04', 'The system shall deliver notifications by WhatsApp where a mobile number is available.', 'Partial — implemented; requires client completion of message template approval'],
        ['FR-NOTE-05', 'The system shall deliver a facility notification to the facility owner and to every active team member of that facility.', 'Implemented'],
        ['FR-NOTE-06', 'The system shall exclude personal data from stored notification payloads.', 'Implemented'],
        ['FR-NOTE-07', 'The system shall ensure that failure of one notification channel does not prevent delivery on the others.', 'Implemented'],
        ['FR-NOTE-08', 'The system shall update inboxes, dashboards, and bed counts in place as underlying events occur.', 'Implemented'],
        ['FR-DOC-01', 'The system shall generate downloadable records for referrals, consultant and hospital rosters, laboratory records, and party profiles.', 'Implemented'],
        ['FR-DOC-02', 'The system shall include uploaded attachments within generated referral documents, embedding images and merging attached documents.', 'Implemented'],
        ['FR-DOC-03', 'The system shall allow a consultant to export an earnings statement.', 'Implemented'],
        ['FR-DOC-04', 'The system shall allow a hospital to export its financial ledger in a spreadsheet-compatible format.', 'Implemented'],
        ['FR-DOC-05', 'The system shall accept uploaded files of image and document type only, subject to a maximum size, and shall store them in cloud storage.', 'Implemented'],
        ['FR-DOC-06', 'The system shall support online payment through a payment gateway, with cryptographic signing of requests and verification of callbacks.', 'Partial — implemented; requires client live merchant credentials'],
      ],
      [0.85, 4.4, 0.9],
    );

    // ---------------------------------------------------------------- 11
    b.h(1, 'Non-Functional Requirements');

    b.h(2, 'Security');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['NFR-SEC-01', 'Passwords shall be stored only as salted cryptographic hashes, never in recoverable form.', 'Implemented'],
        ['NFR-SEC-02', 'Patient national identity numbers shall be encrypted before storage.', 'Implemented'],
        ['NFR-SEC-03', 'All API access shall require a valid authentication credential, except for registration, sign-in, password reset, public branding, and the payment gateway callback.', 'Partial — the file upload endpoint is currently reachable without authentication and is scheduled for correction'],
        ['NFR-SEC-04', 'Every endpoint shall enforce the role permitted to call it.', 'Implemented'],
        ['NFR-SEC-05', 'Authentication endpoints shall be rate limited to resist automated guessing.', 'Implemented'],
        ['NFR-SEC-06', 'All other endpoints shall be rate limited.', 'Not implemented — recommended'],
        ['NFR-SEC-07', 'Standard protective HTTP response headers shall be applied to all responses.', 'Implemented'],
        ['NFR-SEC-08', 'Cross-origin access shall be restricted to configured origins in production.', 'Partial — supported, but permissive if left unconfigured; must be set at deployment'],
        ['NFR-SEC-09', 'Payment gateway callbacks shall be verified cryptographically before being acted upon.', 'Implemented'],
        ['NFR-SEC-10', 'Administrative actions shall be recorded in an immutable-by-convention audit log.', 'Implemented'],
        ['NFR-SEC-11', 'Password reset and email verification credentials shall be single use and time limited.', 'Implemented'],
        ['NFR-SEC-12', 'Patient identity encryption shall provide tamper detection as well as confidentiality.', 'Not implemented — the mode in use provides confidentiality only; upgrade recommended'],
      ],
      [0.85, 4.4, 1.1],
    );

    b.h(2, 'Performance and Scalability');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['NFR-PERF-01', 'Hospital ranking shall be computed on demand and returned within an interactive response time for a metropolitan-scale hospital set.', 'Implemented'],
        ['NFR-PERF-02', 'The escalation check shall run every minute and shall complete within its interval.', 'Implemented'],
        ['NFR-PERF-03', 'Frequently queried fields shall be indexed, including geographic coordinates, user role and status, and notification recipient.', 'Implemented'],
        ['NFR-PERF-04', 'Client-side caching shall prevent redundant repeat requests for unchanged data.', 'Implemented'],
        ['NFR-PERF-05', 'Real-time events shall be addressed to specific users, roles, or facilities rather than broadcast to all connections.', 'Implemented'],
        ['NFR-PERF-06', 'The backend shall be capable of running as more than one concurrent instance.', 'Not implemented — one-time-password state is held in process memory, which constrains the system to a single instance'],
      ],
      [0.85, 4.4, 1.1],
    );

    b.h(2, 'Reliability and Integrity');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['NFR-REL-01', 'Billing a case shall be idempotent, so that a repeated request cannot duplicate a commission accrual.', 'Implemented'],
        ['NFR-REL-02', 'Referral code allocation shall be atomic, so that concurrent referrals cannot receive the same code.', 'Implemented'],
        ['NFR-REL-03', 'Failure of a notification channel shall not fail the operation that raised the notification.', 'Implemented'],
        ['NFR-REL-04', 'A failed backend process shall restart automatically.', 'Implemented'],
        ['NFR-REL-05', 'Monetary arithmetic shall not be subject to floating-point rounding error.', 'Implemented'],
        ['NFR-REL-06', 'Commercial terms in force at the time of a calculation shall be recoverable afterwards.', 'Implemented'],
      ],
      [0.85, 4.4, 1.1],
    );

    b.h(2, 'Usability and Accessibility');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['NFR-USE-01', 'The interface shall be usable on desktop, tablet, and mobile without a separate application.', 'Implemented'],
        ['NFR-USE-02', 'Complex data entry shall be presented as guided steps with visible progress.', 'Implemented'],
        ['NFR-USE-03', 'The interface shall offer a light and a dark appearance, remembered per browser.', 'Implemented'],
        ['NFR-USE-04', 'Every action shall produce visible confirmation of success or failure.', 'Implemented'],
        ['NFR-USE-05', 'Time-critical information shall be presented as a live countdown rather than a static timestamp.', 'Implemented'],
        ['NFR-USE-06', 'The platform operator and individual hospitals shall be able to apply their own branding without redeployment.', 'Implemented'],
      ],
      [0.85, 4.4, 1.1],
    );

    b.h(2, 'Maintainability');

    b.table(
      ['ID', 'Requirement', 'Status'],
      [
        ['NFR-MNT-01', 'The backend shall separate routing, request handling, business logic, and data access into distinct layers.', 'Implemented'],
        ['NFR-MNT-02', 'Financially material logic shall be covered by automated tests.', 'Implemented'],
        ['NFR-MNT-03', 'All configuration and secrets shall be supplied by environment settings, never committed to source.', 'Implemented'],
        ['NFR-MNT-04', 'Every configuration setting the system reads shall be documented.', 'Partial — the payment gateway and messaging settings are documented in a separate runbook rather than the main configuration template; consolidation recommended'],
        ['NFR-MNT-05', 'Controllers, routes, and scheduled jobs shall be covered by integration tests.', 'Not implemented — recommended'],
      ],
      [0.85, 4.4, 1.1],
    );

    // ---------------------------------------------------------------- 12
    b.h(1, 'Requirements Summary');

    b.table(
      ['Area', 'Implemented', 'Partial', 'Not implemented', 'Total'],
      [
        ['Identity and access', '23', '0', '0', '23'],
        ['Referral creation and matching', '19', '0', '0', '19'],
        ['Referral lifecycle', '16', '0', '0', '16'],
        ['Admissions and hospital operations', '12', '0', '0', '12'],
        ['Laboratory module', '14', '0', '0', '14'],
        ['Commission and settlement', '22', '0', '0', '22'],
        ['Platform administration', '15', '0', '0', '15'],
        ['Notifications, documents, payments', '12', '2', '0', '14'],
        ['Non-functional', '28', '4', '4', '36'],
        ['Delivered scope total', '161', '6', '4', '171'],
      ],
      [2.4, 0.8, 0.7, 1, 0.7],
    );

    b.p(
      'Within the delivered scope, 161 of 171 requirements are fully implemented. Six are partial: two ' +
      'await a client action to activate an optional integration, and four are non-functional items ' +
      'requiring configuration or a documented improvement. Four are not implemented, all ' +
      'non-functional, and each is recorded with a recommendation in the Security and Compliance ' +
      'document.',
    );
  },
};
