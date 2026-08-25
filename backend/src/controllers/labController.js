const Laboratory = require('../models/Laboratory');
const { getLabForUser } = require('../utils/resolveOrg');
const LabReferral = require('../models/LabReferral');
const LabPayout = require('../models/LabPayout');

async function ownLab(req, res) {
  const lab = await getLabForUser(req.user);
  if (!lab) {
    res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    return null;
  }
  return lab;
}

exports.getProfile = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    res.json({ success: true, data: lab });
  } catch (error) {
    console.error('[LAB_PROFILE_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lab profile' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;

    const [pending, accepted, reported, closed] = await Promise.all([
      LabReferral.countDocuments({ targetLaboratoryId: lab._id, status: 'pending' }),
      LabReferral.countDocuments({ targetLaboratoryId: lab._id, status: 'accepted' }),
      LabReferral.countDocuments({ targetLaboratoryId: lab._id, status: 'reported' }),
      LabReferral.countDocuments({ targetLaboratoryId: lab._id, status: 'closed' }),
    ]);

    // Amount owed to the platform from billed-but-unsettled cases
    const unsettled = await LabPayout.find({ laboratoryId: lab._id, weeklySettlementId: null });
    const platformCutOwedPaisa = unsettled.reduce((sum, p) => sum + (p.platformCutPaisa || 0), 0);
    const grossClosedPaisa = unsettled.reduce((sum, p) => sum + (p.totalBillPaisa || 0), 0);

    res.json({
      success: true,
      data: {
        counts: { pending, accepted, reported, closed },
        platformCutOwedPaisa,
        grossClosedPaisa,
      },
    });
  } catch (error) {
    console.error('[LAB_DASHBOARD_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};

exports.getTestCatalog = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    res.json({ success: true, data: lab.testCatalog });
  } catch (error) {
    console.error('[LAB_CATALOG_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch test catalog' });
  }
};

exports.addTest = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const { testName, price, turnaroundHours } = req.body;
    if (!String(testName || '').trim() || Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Valid test name and price are required' });
    }
    lab.testCatalog.push({
      testName: String(testName).trim(),
      price: Math.max(0, Number(price) || 0),
      turnaroundHours: Math.max(0, Number(turnaroundHours) || 24),
    });
    await lab.save();
    res.status(201).json({ success: true, data: lab.testCatalog });
  } catch (error) {
    console.error('[LAB_ADD_TEST_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to add test' });
  }
};

exports.updateTest = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const test = lab.testCatalog.id(req.params.testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }
    const { testName, price, turnaroundHours } = req.body;
    if (testName != null) test.testName = String(testName).trim();
    if (price != null) test.price = Math.max(0, Number(price) || 0);
    if (turnaroundHours != null) test.turnaroundHours = Math.max(0, Number(turnaroundHours) || 24);
    await lab.save();
    res.json({ success: true, data: lab.testCatalog });
  } catch (error) {
    console.error('[LAB_UPDATE_TEST_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to update test' });
  }
};

exports.deleteTest = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const test = lab.testCatalog.id(req.params.testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }
    test.deleteOne();
    await lab.save();
    res.json({ success: true, data: lab.testCatalog });
  } catch (error) {
    console.error('[LAB_DELETE_TEST_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to delete test' });
  }
};
