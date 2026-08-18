const { meta } = require('../common');

module.exports = {
  meta: meta(
    'CB-QA-2026-006',
    'Test Plan & QA Report',
    'Test strategy, automated suite results, acceptance scenarios by role, and the defect position at handover',
  ),

  body(b) {
    // ---------------------------------------------------------------- 1
    b.h(1, 'Introduction');

    b.h(2, 'Purpose');

    b.p(
      'This document records how CareBridge was tested and what the testing found. It states the ' +
      'strategy adopted and the reasoning behind it, reports the results of the automated suite, sets ' +
      'out the acceptance scenarios that were exercised manually for each role, and states plainly ' +
      'what is not covered by automated testing.',
    );

    b.h(2, 'Test Strategy and Its Rationale');

    b.p(
      'Testing effort was concentrated where a defect would be both financially material and hard to ' +
      'detect by inspection. In a platform that divides money between three parties under two ' +
      'commission models and four rate combinations, an arithmetic error does not announce itself — it ' +
      'produces a plausible figure that is quietly wrong. That class of defect is the reason the ' +
      'automated suite is weighted heavily towards the commission engine.',
    );

    b.table(
      ['Layer', 'Approach', 'Justification'],
      [
        ['Commission and pricing logic', 'Exhaustive automated unit testing, including the governing invariant and boundary cases.', 'A wrong figure here is silent, systematic, and financially material. It is also pure logic with no external dependency, so it can be tested exhaustively at low cost.'],
        ['Matching engine', 'Automated unit testing of scoring, hard filters, and distance.', 'Determines which hospital receives a referral. A filter defect would route an emergency to a hospital with no intensive care bed.'],
        ['Field encryption', 'Automated round-trip and edge-case testing.', 'Protects patient identity data. A failure would either corrupt data or expose it.'],
        ['Document generation', 'Automated validity testing of every generated document type.', 'Documents leave the system and reach patients and accountants. A malformed document is visible and reputationally costly.'],
        ['Account hierarchy', 'Automated testing of the creation-chain check.', 'Governs whether one team member may delete another — a privilege decision.'],
        ['Controllers, routes, workflows', 'Manual scenario testing against a running system.', 'Requires a database, authenticated sessions, and multi-role interaction. Covered manually in this delivery; automation is the principal recommendation of this report.'],
        ['User interface', 'Manual testing across roles, browsers, and screen sizes.', 'Visual and interaction behaviour.'],
      ],
      [1.2, 1.9, 2.8],
    );

    b.h(2, 'Test Environment');

    b.table(
      ['Aspect', 'Detail'],
      [
        ['Automated suite', 'Node.js built-in test runner. No database, network, or external service required, so the suite runs in seconds and cannot fail for environmental reasons.'],
        ['Manual testing', 'Performed against the deployed environment with real integrations — email delivery, file storage, and live socket connections.'],
        ['Test data', 'Seeded accounts for each role, plus records created during the scenarios themselves.'],
        ['Browsers', 'Chrome, Edge, and Firefox on desktop; Chrome and Safari on mobile.'],
      ],
      [1, 4],
    );

    // ---------------------------------------------------------------- 2
    b.h(1, 'Automated Test Results');

    b.h(2, 'Summary');

    b.p(
      'The suite was executed in full at the time of this report. All tests pass; none are skipped or ' +
      'marked pending.',
    );

    b.table(
      ['Suite', 'Tests', 'Passed', 'Failed', 'Skipped'],
      [
        ['Commission engine', '17', '17', '0', '0'],
        ['PDF export service', '12', '12', '0', '0'],
        ['Scoring engine', '6', '6', '0', '0'],
        ['Field encryption', '4', '4', '0', '0'],
        ['Account hierarchy', '1', '1', '0', '0'],
        ['Total', '40', '40', '0', '0'],
      ],
      [2.4, 0.8, 0.8, 0.8, 0.8],
    );

    b.code(
      [
        '$ cd backend && npm test',
        '',
        '  ...',
        '  1..40',
        '  # tests 40',
        '  # suites 0',
        '  # pass 40',
        '  # fail 0',
        '  # cancelled 0',
        '  # skipped 0',
        '  # todo 0',
        '  # duration_ms 2730.8',
      ].join('\n'),
    );

    b.h(2, 'Commission Engine — 17 Tests');

    b.p(
      'The most thorough suite in the system, and deliberately so. It covers both commission models, ' +
      'both component types, both facility types, the override hierarchy, and the boundary cases where ' +
      'the arithmetic becomes commercially awkward.',
    );

    b.table(
      ['Case', 'Verifies'],
      [
        ['Rupee-to-paisa conversion guards', 'Negative and non-numeric input converts to zero rather than propagating an invalid value into a monetary field.'],
        ['Percentage clamping', 'Values outside zero to one hundred are bounded; non-numeric values become zero.'],
        ['Nested model, hospital', 'Reproduces the original nested calculation exactly, so that adopting the engine changed no existing figure.'],
        ['Nested model, laboratory', 'The same for laboratory referrals, including discount handling.'],
        ['Additive, hospital, percentage consultant fee', 'Consultant fee and platform charge computed independently and summed.'],
        ['Additive, hospital, fixed consultant fee', 'A fixed fee is charged in full irrespective of bill size.'],
        ['Additive, laboratory, percentage', 'Percentage components applied across the discounted bill.'],
        ['Additive, laboratory, fixed per test', 'A fixed laboratory charge applies once per test, so a five-test referral incurs it five times.'],
        ['Facility-level platform charge override', 'A facility\'s own terms take precedence over the platform default.'],
        ['Consultant-facility override applied', 'A negotiated rate between one consultant and one facility takes precedence over both.'],
        ['Consultant-facility override scope', 'An override recorded for one hospital does not apply at a different hospital — the specific defect this tier could most plausibly introduce.'],
        ['Override preserves the nested consultant fee', 'Where an override applies to a consultant still on the nested model, the consultant fee is unchanged byte for byte and only the platform charge is substituted.'],
        ['The governing invariant, nested model', 'Total deduction equals consultant fee plus platform charge.'],
        ['The governing invariant, additive model', 'The same identity holds, which is what allows settlements to mix consultants on different models.'],
        ['Zero bill', 'A bill of zero produces zero across every component rather than an error or a negative figure.'],
        ['Fixed charge exceeding a small bill', 'The facility residual goes negative and is reported faithfully rather than silently clamped — a commercial configuration question, not an arithmetic one.'],
        ['Mixed-rate aggregation', 'Consultants on different models and rates total correctly within one settlement.'],
      ],
      [1.6, 3.6],
    );

    b.h(2, 'Scoring Engine — 6 Tests');

    b.table(
      ['Case', 'Verifies'],
      [
        ['Full match score composition', 'Each factor contributes its expected share to the total.'],
        ['Department absent', 'The hospital is excluded outright rather than scored low.'],
        ['No available bed', 'The hospital is excluded outright.'],
        ['Emergency requires an intensive care bed', 'Emergency referrals filter on intensive care availability specifically, not general beds.'],
        ['Score cap', 'The total is capped at 100 even where factors would exceed it.'],
        ['Distance for identical coordinates', 'Distance between coincident points is approximately zero, confirming the calculation is not systematically offset.'],
      ],
      [1.6, 3.6],
    );

    b.h(2, 'PDF Export Service — 12 Tests');

    b.table(
      ['Case', 'Verifies'],
      [
        ['Eight document builders', 'Each of the eight generated document types produces a structurally valid document: referral record, consultant roster, hospital records, consultant file, hospital file, laboratory referral record, laboratory roster, and laboratory file.'],
        ['Single-page output for short records', 'A short record produces exactly one page, confirming no spurious trailing page.'],
        ['Image attachments embedded', 'Uploaded images are embedded as pages within the generated document.'],
        ['Document attachments merged', 'Attached documents are merged page for page rather than referenced or dropped.'],
      ],
      [1.6, 3.6],
    );

    b.h(2, 'Field Encryption — 4 Tests');

    b.table(
      ['Case', 'Verifies'],
      [
        ['Round trip', 'A value encrypted and then decrypted returns the original exactly.'],
        ['Distinct output per encryption', 'The same value encrypted twice produces different stored values, confirming a fresh initialisation vector each time — without which identical identity numbers would be linkable in the database.'],
        ['Empty value pass-through', 'Empty and absent values are handled without error.'],
        ['Unencrypted value pass-through', 'A value not in encrypted form passes through unchanged, so records predating encryption remain readable.'],
      ],
      [1.6, 3.6],
    );

    b.h(2, 'Account Hierarchy — 1 Test');

    b.table(
      ['Case', 'Verifies'],
      [
        ['Creation-chain ancestry', 'The check correctly identifies both a direct creator and an ancestor further up the chain, which is what prevents a team member from deleting an account above their own.'],
      ],
      [1.6, 3.6],
    );

    // ---------------------------------------------------------------- 3
    b.h(1, 'Coverage Assessment');

    b.h(2, 'What Is Covered Automatically');

    b.bullets([
      'All bill-splitting arithmetic, across both models, both component types, both facility types, and the full override hierarchy.',
      'Hospital scoring, including both hard filters and the emergency ward requirement.',
      'Patient identity encryption and decryption, including backward compatibility with unencrypted records.',
      'Generation of all eight document types, including attachment embedding and merging.',
      'The account creation-chain check governing team member deletion.',
    ]);

    b.h(2, 'What Is Not Covered Automatically');

    b.note(
      'This is a complete statement, not a summary',
      'The following areas have no automated test coverage. They were verified by the manual scenarios ' +
      'in the next chapter, which confirms they worked at the time of testing but provides no ' +
      'protection against future regression. This is the principal quality recommendation of this ' +
      'report.',
      'warn',
    );

    b.table(
      ['Area', 'Risk if it regresses', 'Priority to automate'],
      [
        ['Settlement state machines', 'A settlement could advance without the required verification, releasing payouts against an unverified receipt. This is the highest-value automation target in the system.', 'High'],
        ['Referral escalation scheduler', 'Overdue referrals silently stop escalating, defeating a core platform guarantee. Failure is invisible until a consultant complains.', 'High'],
        ['Authentication and authorisation middleware', 'A role boundary could be weakened without detection.', 'High'],
        ['Controllers and routes', 'Input validation or status transition rules could regress.', 'Medium'],
        ['Notification fan-out', 'A party stops being notified of an event that concerns them.', 'Medium'],
        ['Payment gateway signing and callback verification', 'Signature verification could weaken, though the feature is not currently active.', 'Medium'],
        ['Superseded wallet crediting module', 'Not connected to the current flow; recommended for removal rather than testing.', 'Low — remove instead'],
        ['Frontend components', 'Interface regressions.', 'Low'],
      ],
      [1.5, 3, 0.9],
    );

    // ---------------------------------------------------------------- 4
    b.h(1, 'Acceptance Test Scenarios');

    b.p(
      'The following scenarios were executed manually against the deployed system. They are recorded ' +
      'in enough detail to be re-run as a regression pass after any significant change, and are ' +
      'grouped by role.',
    );

    b.h(2, 'Registration and Approval');

    b.table(
      ['ID', 'Scenario', 'Expected result', 'Result'],
      [
        ['AT-REG-01', 'Register as a consultant with complete details and documents.', 'Account created pending; verification code sent; administrators notified.', 'Pass'],
        ['AT-REG-02', 'Attempt to register with an email already in use.', 'Rejected with a clear message; no duplicate account created.', 'Pass'],
        ['AT-REG-03', 'Attempt to submit registration without accepting the policy.', 'Submission blocked.', 'Pass'],
        ['AT-REG-04', 'Enter the emailed verification code.', 'Email marked verified.', 'Pass'],
        ['AT-REG-05', 'Enter an incorrect verification code.', 'Rejected; the attempt is counted and repeated failure invalidates the code.', 'Pass'],
        ['AT-REG-06', 'Attempt to sign in before approval.', 'Refused, stating the account is pending.', 'Pass'],
        ['AT-REG-07', 'Approve the application as an administrator.', 'Account activated; applicant notified; sign-in succeeds.', 'Pass'],
        ['AT-REG-08', 'Reject an application with a reason.', 'Applicant notified with the reason; sign-in remains refused.', 'Pass'],
        ['AT-REG-09', 'Register a hospital including departments and bed inventory.', 'Account created pending; bed inventory recorded per ward.', 'Pass'],
        ['AT-REG-10', 'Register a laboratory including an initial test catalogue.', 'Account created pending; catalogue recorded with prices and turnaround times.', 'Pass'],
        ['AT-REG-11', 'Request a password reset and follow the emailed link.', 'Password changed; sign-in succeeds with the new password; the link cannot be reused.', 'Pass'],
        ['AT-REG-12', 'Request a password reset for an unregistered address.', 'Success reported without disclosing whether the address is registered.', 'Pass'],
      ],
      [0.9, 2.3, 2.6, 0.6],
    );

    b.h(2, 'Consultant Workflow');

    b.table(
      ['ID', 'Scenario', 'Expected result', 'Result'],
      [
        ['AT-CON-01', 'Create a routine referral through the four-step wizard.', 'Referral created with a unique code and a twenty-four hour response deadline.', 'Pass'],
        ['AT-CON-02', 'Enter a patient age of eight months.', 'An approximate date of birth is derived and the age displays in months.', 'Pass'],
        ['AT-CON-03', 'Request hospital recommendations.', 'Hospitals returned in ranked order with the reasons for each ranking shown.', 'Pass'],
        ['AT-CON-04', 'Request recommendations where no hospital operates the required department.', 'No hospitals returned; the consultant is not offered an unsuitable option.', 'Pass'],
        ['AT-CON-05', 'Create an emergency referral.', 'A fifteen-minute deadline is set and the referral appears on the hospital emergency board.', 'Pass'],
        ['AT-CON-06', 'Select a specific department and named doctor.', 'Both are recorded and visible to the receiving hospital.', 'Pass'],
        ['AT-CON-07', 'Submit to two hospitals.', 'Two independent referrals created, each separately tracked.', 'Pass'],
        ['AT-CON-08', 'Favourite a hospital and create a further referral.', 'The favourited hospital ranks higher in subsequent recommendations.', 'Pass'],
        ['AT-CON-09', 'Edit a pending referral.', 'Changes saved.', 'Pass'],
        ['AT-CON-10', 'Attempt to edit an admitted referral.', 'Editing refused; the record is locked from admission onward.', 'Pass'],
        ['AT-CON-11', 'Download a referral record.', 'A valid document is produced with attachments included.', 'Pass'],
        ['AT-CON-12', 'View earnings after a case is billed.', 'Commission appears with the correct amount and its terms snapshot.', 'Pass'],
        ['AT-CON-13', 'Request a withdrawal below the minimum.', 'Refused, stating the minimum.', 'Pass'],
        ['AT-CON-14', 'Confirm receipt of a payout.', 'Payout marked confirmed; the settlement advances.', 'Pass'],
      ],
      [0.9, 2.3, 2.6, 0.6],
    );

    b.h(2, 'Hospital Workflow');

    b.table(
      ['ID', 'Scenario', 'Expected result', 'Result'],
      [
        ['AT-HOS-01', 'Receive a referral in the inbox.', 'Referral appears without a page refresh; the countdown runs live.', 'Pass'],
        ['AT-HOS-02', 'Attempt to accept without selecting a department.', 'Acceptance blocked until a department is chosen.', 'Pass'],
        ['AT-HOS-03', 'Accept a referral with a department.', 'Status changes to accepted; the consultant is notified.', 'Pass'],
        ['AT-HOS-04', 'Attempt to reject without a reason.', 'Rejection blocked until a reason is given.', 'Pass'],
        ['AT-HOS-05', 'Reject a referral with a reason.', 'The consultant sees the reason.', 'Pass'],
        ['AT-HOS-06', 'Allow a referral to pass its deadline.', 'Within a minute the referral escalates to the next ranked hospital with a fresh deadline; both hospitals and the consultant are notified.', 'Pass'],
        ['AT-HOS-07', 'Allow an emergency referral to pass its deadline with an exhausted queue.', 'The referral is reassigned to the nearest active hospital within twenty kilometres.', 'Pass'],
        ['AT-HOS-08', 'Admit an accepted referral.', 'Ward, room, bed, department, and treating doctor are all required; status changes to admitted.', 'Pass'],
        ['AT-HOS-09', 'Record clinical notes.', 'Notes appear on the timeline with author and time, and are visible to the consultant.', 'Pass'],
        ['AT-HOS-10', 'Complete a case with three service lines.', 'Total calculated correctly; referral closed; commission accrued.', 'Pass'],
        ['AT-HOS-11', 'Submit the completion request twice.', 'No second accrual is created; the operation is idempotent.', 'Pass'],
        ['AT-HOS-12', 'Adjust bed counts.', 'Counts update and are immediately reflected in recommendations.', 'Pass'],
        ['AT-HOS-13', 'Reduce beds in a ward to zero.', 'The hospital is excluded from recommendations requiring that ward.', 'Pass'],
        ['AT-HOS-14', 'Export the financial ledger.', 'A spreadsheet-compatible file downloads with correct figures.', 'Pass'],
        ['AT-HOS-15', 'Add a team member and sign in as them.', 'The member can work the inbox and admissions.', 'Pass'],
        ['AT-HOS-16', 'Attempt to delete the account that created your own.', 'Refused by the creation-chain check.', 'Pass'],
        ['AT-HOS-17', 'Apply hospital branding.', 'Logo and colour apply for that hospital\'s users only.', 'Pass'],
      ],
      [0.9, 2.3, 2.6, 0.6],
    );

    b.h(2, 'Laboratory Workflow');

    b.table(
      ['ID', 'Scenario', 'Expected result', 'Result'],
      [
        ['AT-LAB-01', 'Create a laboratory referral with three tests.', 'Referral created with its own code sequence.', 'Pass'],
        ['AT-LAB-02', 'Apply a discount above the consultant\'s maximum.', 'Capped at the consultant\'s configured maximum.', 'Pass'],
        ['AT-LAB-03', 'Attempt to accept without an expected report time.', 'Acceptance blocked until one is committed.', 'Pass'],
        ['AT-LAB-04', 'Accept with an expected report time.', 'Status changes to accepted; the commitment is visible to the consultant.', 'Pass'],
        ['AT-LAB-05', 'Reject a referral, then re-refer it as the consultant.', 'A new referral is created for a different laboratory without re-entering patient details.', 'Pass'],
        ['AT-LAB-06', 'Upload report files.', 'Files attached; the consultant is notified; status changes to reported.', 'Pass'],
        ['AT-LAB-07', 'Price the ordered tests.', 'Catalogue prices pre-fill where names match and can be adjusted.', 'Pass'],
        ['AT-LAB-08', 'Attempt to change an ordered test description.', 'Not permitted; the consultant\'s order is fixed.', 'Pass'],
        ['AT-LAB-09', 'Finalise a referral.', 'Bill computed as gross less discount; referral closed; commission accrued.', 'Pass'],
        ['AT-LAB-10', 'Finalise with a fixed per-test platform charge and five tests.', 'The charge applies five times, once per test.', 'Pass'],
        ['AT-LAB-11', 'Maintain the test catalogue.', 'Tests added, amended, and removed; prices flow into billing.', 'Pass'],
      ],
      [0.9, 2.3, 2.6, 0.6],
    );

    b.h(2, 'Settlement Cycle');

    b.table(
      ['ID', 'Scenario', 'Expected result', 'Result'],
      [
        ['AT-SET-01', 'Assemble a hospital settlement from billed admissions.', 'Settlement created in pending payment; totals match the sum of the accruals.', 'Pass'],
        ['AT-SET-02', 'Assemble a settlement containing consultants on different commission models.', 'Totals reconcile correctly across mixed models — the requirement the additive model was introduced to satisfy.', 'Pass'],
        ['AT-SET-03', 'Upload a payment receipt.', 'Settlement advances to pending administrator verification.', 'Pass'],
        ['AT-SET-04', 'Reject the receipt as an administrator with a reason.', 'Settlement returns to the hospital with the reason visible; a corrected receipt can be uploaded.', 'Pass'],
        ['AT-SET-05', 'Verify the receipt as an administrator.', 'Settlement advances to pending consultant payout.', 'Pass'],
        ['AT-SET-06', 'Record consultant payouts with receipts.', 'Settlement advances to pending consultant verification; consultants notified.', 'Pass'],
        ['AT-SET-07', 'Confirm receipt as each consultant.', 'Settlement completes once all payouts are confirmed.', 'Pass'],
        ['AT-SET-08', 'Confirm receipt as only one of two consultants.', 'Settlement remains open; completion requires all confirmations.', 'Pass'],
        ['AT-SET-09', 'Run the equivalent cycle for a laboratory.', 'The laboratory cycle behaves identically through all five states.', 'Pass'],
      ],
      [0.9, 2.3, 2.6, 0.6],
    );

    b.h(2, 'Administration');

    b.table(
      ['ID', 'Scenario', 'Expected result', 'Result'],
      [
        ['AT-ADM-01', 'Set matching weights totalling 100.', 'Saved and applied to subsequent recommendations.', 'Pass'],
        ['AT-ADM-02', 'Attempt to set weights not totalling 100.', 'Refused by both the interface and the data layer.', 'Pass'],
        ['AT-ADM-03', 'Set a consultant to the additive model with a fixed fee.', 'Subsequent cases use the additive calculation; existing accruals are unchanged.', 'Pass'],
        ['AT-ADM-04', 'Set a consultant-facility override.', 'Applied at that facility only, and not at any other.', 'Pass'],
        ['AT-ADM-05', 'Change a platform default where an override exists.', 'The override continues to take precedence, as designed.', 'Pass'],
        ['AT-ADM-06', 'Add a department with symptom keywords.', 'Symptoms containing those keywords suggest the department.', 'Pass'],
        ['AT-ADM-07', 'Suspend an account.', 'Sign-in refused; the existing session ends at the next renewal, within an hour.', 'Pass'],
        ['AT-ADM-08', 'Reset a user\'s password.', 'The user can sign in with the new password.', 'Pass'],
        ['AT-ADM-09', 'Correct a referral, including admission details.', 'Changes saved and visible to the parties.', 'Pass'],
        ['AT-ADM-10', 'Attempt to delete a referral.', 'Three confirmations required, ending with typing the patient name.', 'Pass'],
        ['AT-ADM-11', 'Change platform branding.', 'Applied across the platform without redeployment.', 'Pass'],
        ['AT-ADM-12', 'Review and export the audit log.', 'Administrative actions recorded with actor, action, record, and time; export succeeds.', 'Pass'],
        ['AT-ADM-13', 'Correct a hospital\'s bed counts.', 'Counts update and affect recommendations immediately.', 'Pass'],
      ],
      [0.9, 2.3, 2.6, 0.6],
    );

    b.h(2, 'Cross-Cutting Behaviour');

    b.table(
      ['ID', 'Scenario', 'Expected result', 'Result'],
      [
        ['AT-GEN-01', 'Create a referral in one browser while a hospital user watches the inbox in another.', 'The referral appears without a refresh.', 'Pass'],
        ['AT-GEN-02', 'Trigger several events in quick succession.', 'The interface refreshes once rather than repeatedly, confirming event collapsing.', 'Pass'],
        ['AT-GEN-03', 'Remain signed in beyond the access token lifetime.', 'The session renews transparently; work is not interrupted.', 'Pass'],
        ['AT-GEN-04', 'Attempt to open a screen belonging to another role.', 'Redirected away.', 'Pass'],
        ['AT-GEN-05', 'Call an endpoint outside the caller\'s role directly.', 'Refused with a forbidden response.', 'Pass'],
        ['AT-GEN-06', 'Call any endpoint as an administrator.', 'Permitted — the administrator bypass is intended behaviour.', 'Pass'],
        ['AT-GEN-07', 'Upload a file of an unsupported type.', 'Rejected on both extension and declared content type.', 'Pass'],
        ['AT-GEN-08', 'Upload a file above the size limit.', 'Rejected.', 'Pass'],
        ['AT-GEN-09', 'Use the platform on a mobile screen.', 'Navigation adapts to a scrolling bar; all workflows remain usable.', 'Pass'],
        ['AT-GEN-10', 'Switch between light and dark appearance.', 'Applied immediately and remembered for that browser.', 'Pass'],
        ['AT-GEN-11', 'Inspect a stored patient identity number directly in the database.', 'Stored encrypted, not in readable form.', 'Pass'],
        ['AT-GEN-12', 'Store the same identity number on two referrals.', 'The two stored values differ, confirming a fresh initialisation vector per encryption.', 'Pass'],
      ],
      [0.9, 2.3, 2.6, 0.6],
    );

    b.h(2, 'Acceptance Summary');

    b.table(
      ['Group', 'Scenarios', 'Passed', 'Failed'],
      [
        ['Registration and approval', '12', '12', '0'],
        ['Consultant workflow', '14', '14', '0'],
        ['Hospital workflow', '17', '17', '0'],
        ['Laboratory workflow', '11', '11', '0'],
        ['Settlement cycle', '9', '9', '0'],
        ['Administration', '13', '13', '0'],
        ['Cross-cutting behaviour', '12', '12', '0'],
        ['Total', '88', '88', '0'],
      ],
      [2.4, 1, 1, 1],
    );

    // ---------------------------------------------------------------- 5
    b.h(1, 'Defect Position');

    b.h(2, 'Open Defects');

    b.p(
      'There are no open functional defects. Every scenario in Chapter 4 passes and the automated suite ' +
      'passes in full.',
    );

    b.h(2, 'Open Non-Functional Findings');

    b.p(
      'The following are recorded as findings rather than defects: the system behaves as built, but the ' +
      'behaviour should change. Each is described fully in the Security and Compliance document or the ' +
      'Maintenance and Support Guide.',
    );

    b.table(
      ['Ref', 'Finding', 'Severity', 'Recommendation'],
      [
        ['QA-01', 'The file upload endpoint does not require authentication. Uploads are type and size constrained, and an uploaded file is meaningless until an authenticated user attaches it to a record, but the endpoint is open.', 'High', 'Place behind authentication before wider release. This is the single highest-priority action in the package.'],
        ['QA-02', 'Rate limiting is applied only to authentication endpoints, leaving the remainder of the interface without protection against automated abuse.', 'Medium', 'Apply a global limit with a higher ceiling.'],
        ['QA-03', 'Patient identity encryption provides confidentiality but not tamper detection.', 'Medium', 'Migrate to an authenticated encryption mode, with a data migration.'],
        ['QA-04', 'One-time-password state is held in process memory, so codes are lost on restart and the backend cannot be scaled beyond one instance.', 'Medium', 'Move to a shared cache.'],
        ['QA-05', 'A superseded wallet crediting module remains in the codebase and recomputes commission arithmetic outside the tested engine.', 'Medium', 'Remove it; it is the only violation of the single-calculation-path principle.'],
        ['QA-06', 'No integration test coverage of controllers, routes, the escalation scheduler, or the settlement state machines.', 'Medium', 'Add integration tests, starting with the settlement state machine and the scheduler.'],
        ['QA-07', 'The cross-origin setting defaults to permissive when left blank.', 'Medium', 'Set explicitly at deployment; included in the go-live checklist.'],
        ['QA-08', 'Stored documents are reachable by direct link without an authentication check.', 'Medium', 'Move to time-limited signed addresses.'],
        ['QA-09', 'Two built screens are not linked into the application.', 'Low', 'Route them or remove them.'],
        ['QA-10', 'Client data fetching uses two different patterns, and two screens open a redundant socket connection.', 'Low', 'Consolidate.'],
        ['QA-11', 'Payment and messaging configuration settings are documented in a separate runbook rather than the main configuration template.', 'Low', 'Consolidate into the template.'],
      ],
      [0.6, 3, 0.7, 2],
    );

    b.h(2, 'Defects Found and Resolved During Development');

    b.p(
      'The commit history records the defect classes addressed during the engagement. They are ' +
      'summarised here for completeness.',
    );

    b.table(
      ['Area', 'Nature of the corrections'],
      [
        ['Commission calculation', 'Consolidation of bill-splitting arithmetic that had been implemented separately in four places, into the single tested engine. This was the most significant correctness work in the project.'],
        ['Payment flow', 'Successive revisions of the settlement flow, converging on the current five-state receipt-based cycle.'],
        ['Age handling', 'Correction of age entry and derivation so that infant and neonatal ages record accurately, with date of birth as the single source of truth.'],
        ['Deployment configuration', 'Correction of the frontend build command and single-page routing rewrites.'],
        ['Laboratory module', 'Iterative delivery of the laboratory referral, billing, and settlement track.'],
        ['Account deletion', 'Introduction of the creation-chain check governing team member removal.'],
        ['Email delivery', 'Migration to the current email provider and correction of verification and reset link construction.'],
      ],
      [1.2, 4],
    );

    // ---------------------------------------------------------------- 6
    b.h(1, 'Recommendations');

    b.h(2, 'Priority Order');

    b.table(
      ['Priority', 'Recommendation', 'Rationale'],
      [
        ['1', 'Place the file upload endpoint behind authentication.', 'The only unauthenticated write endpoint besides the signature-verified payment callback. Small change, meaningful reduction in exposure.'],
        ['2', 'Add integration tests for the settlement state machine.', 'The highest-value untested area. A regression here could release payouts against an unverified receipt — a financial control failure, not merely a bug.'],
        ['3', 'Add an automated test for the escalation scheduler.', 'A core platform guarantee whose failure is silent. Nothing currently detects the job not running.'],
        ['4', 'Apply a global rate limit.', 'Straightforward, and closes the remaining abuse surface.'],
        ['5', 'Remove the superseded wallet crediting module.', 'Eliminates the only commission arithmetic outside the tested engine, and removes a path a future maintainer could reconnect by mistake.'],
        ['6', 'Move one-time-password state to a shared cache.', 'Removes the restart fragility and the first of two barriers to scaling.'],
        ['7', 'Migrate patient identity encryption to an authenticated mode.', 'Adds tamper detection. Requires a data migration, so plan it deliberately.'],
        ['8', 'Move stored documents to time-limited signed addresses.', 'Brings document access under the same access control as the rest of the platform.'],
        ['9', 'Add integration tests for authentication and authorisation middleware.', 'Protects the role boundaries against silent weakening.'],
        ['10', 'Add an uptime check with alerting against the health endpoint.', 'Without it, an outage is discovered by users rather than by the operator.'],
      ],
      [0.7, 2.5, 3],
    );

    b.h(2, 'Suggested Regression Pass');

    b.p(
      'After any significant change, the following short pass exercises the highest-risk paths. It ' +
      'takes well under an hour and would catch the great majority of regressions.',
    );

    b.bullets([
      'Run the automated suite. It requires no database and completes in seconds.',
      'Register a test account, verify it, approve it, and sign in — this exercises registration, email delivery, approval, and authentication together.',
      'Create a referral, accept it, admit the patient, and bill the case — confirm the commission accrual matches the expected split by hand.',
      'Allow a referral to pass its deadline and confirm it escalates within a minute.',
      'Run one settlement from assembly to completion, including a receipt rejection and re-upload.',
      'Confirm live updates work across two browsers.',
    ], { ordered: true });
  },
};
