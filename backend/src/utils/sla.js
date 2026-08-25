/**
 * SLA deadline from urgency (SRS §4.2): emergency 15m, urgent 2h, routine 24h.
 */
function slaDeadlineFromUrgency(urgency, fromDate = new Date()) {
  const d = new Date(fromDate);
  if (urgency === 'emergency') {
    d.setMinutes(d.getMinutes() + 15);
  } else if (urgency === 'urgent') {
    d.setHours(d.getHours() + 2);
  } else {
    d.setHours(d.getHours() + 24);
  }
  return d;
}

module.exports = { slaDeadlineFromUrgency };
