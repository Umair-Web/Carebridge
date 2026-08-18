/**
 * Shared document metadata for the CareBridge handover package.
 * Every deliverable inherits the same client, author, date, and classification
 * so the set reads as one coherent release.
 */

const RELEASE = {
  version: '1.0',
  date: '2026-07-18',
  client: 'CareBridge Health',
  author: 'CareBridge Engineering Team',
  classification: 'Confidential',
};

/** Build a document `meta` block from a reference code, title, and subtitle. */
function meta(ref, title, subtitle) {
  return { ref, title, subtitle, ...RELEASE };
}

/** The four platform roles, used consistently across documents. */
const ROLES = ['consultant', 'hospital', 'laboratory', 'admin'];

module.exports = { RELEASE, meta, ROLES };
