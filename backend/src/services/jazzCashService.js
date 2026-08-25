const crypto = require('crypto');

/**
 * JazzCash API Integration Service (SRS §12)
 * Follows the JazzCash HTTP POST (Redirect) checkout flow.
 */

const JAZZCASH_MERCHANT_ID = process.env.JAZZCASH_MERCHANT_ID || 'T001';
const JAZZCASH_PASSWORD = process.env.JAZZCASH_PASSWORD || 'password';
const JAZZCASH_INTEGRITY_SALT = process.env.JAZZCASH_INTEGRITY_SALT || 'salt';
const JAZZCASH_RETURN_URL = process.env.JAZZCASH_RETURN_URL || 'http://localhost:5000/api/payments/jazzcash-callback';
const JAZZCASH_API_URL = process.env.JAZZCASH_API_URL || 'https://sandbox.jazzcash.com.pk/CustomerPortal/transaction/Checkout';

const createJazzCashRequest = (admission, amountPaisa, customCreds) => {
  const mid = customCreds?.merchantId || JAZZCASH_MERCHANT_ID;
  const pwd = customCreds?.password || JAZZCASH_PASSWORD;
  const salt = customCreds?.integritySalt || JAZZCASH_INTEGRITY_SALT;

  const transactionId = `T${Date.now()}`;
  const now = new Date();
  const pp_TxnDateTime = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
  const pp_TxnExpiryDateTime = expiry.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  const params = {
    pp_Version: '1.1',
    pp_TxnType: '', // Empty allows user to choose between Wallet and Card on the dashboard
    pp_Language: 'EN',
    pp_MerchantID: String(mid),
    pp_SubMerchantID: '',
    pp_Password: String(pwd),
    pp_TxnRefNo: String(transactionId),
    pp_Amount: String(Math.round(amountPaisa)), 
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: String(pp_TxnDateTime),
    pp_BillReference: String(admission._id),
    pp_Description: `Medical Billing - ${admission.referralId?.referralCode || 'CareBridge'}`,
    pp_TxnExpiryDateTime: String(pp_TxnExpiryDateTime),
    pp_ReturnURL: String(JAZZCASH_RETURN_URL),
    pp_SecureHash: '',
    pp_MPIMode: '1',
    pp_IsRegisteredCustomer: 'No',
    pp_BankID: '',
    pp_ProductID: '',
    pp_BasketQuantity: '1',
    pp_BasketPrice: String(Math.round(amountPaisa)),
    pp_CustomerID: String(admission.hospitalId),
    pp_CustomerEmail: '',
    pp_CustomerMobile: '',
    pp_MobileNumber: '',
    pp_CNIC: '',
  };

  const sortedKeys = Object.keys(params).sort();
  let hashString = salt + '&';
  
  for (const key of sortedKeys) {
    if (params[key] !== '' && key !== 'pp_SecureHash') {
      hashString += params[key] + '&';
    }
  }
  hashString = hashString.slice(0, -1);

  const secureHash = crypto
    .createHmac('sha256', salt)
    .update(hashString)
    .digest('hex')
    .toUpperCase();

  params.pp_SecureHash = secureHash;

  console.log('[JAZZCASH] Initiating Payment for Admission:', admission._id);
  console.log('[JAZZCASH] Using Merchant ID:', mid);
  console.log('[JAZZCASH] Amount (Paisa):', params.pp_Amount);

  return {
    url: JAZZCASH_API_URL,
    params
  };
};

const verifyJazzCashHash = (receivedParams, customSalt) => {
  const salt = customSalt || JAZZCASH_INTEGRITY_SALT;
  const { pp_SecureHash, ...params } = receivedParams;
  const sortedKeys = Object.keys(params).sort();
  
  let hashString = salt + '&';
  for (const key of sortedKeys) {
    if (params[key] !== '' && key !== 'pp_SecureHash') {
      hashString += params[key] + '&';
    }
  }
  hashString = hashString.slice(0, -1);

  const expectedHash = crypto
    .createHmac('sha256', salt)
    .update(hashString)
    .digest('hex')
    .toUpperCase();

  return expectedHash === pp_SecureHash;
};

module.exports = { createJazzCashRequest, verifyJazzCashHash };
