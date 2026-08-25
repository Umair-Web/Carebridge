/**
 * WhatsApp Service — Meta Cloud API (WhatsApp Business Platform)
 *
 * PRODUCTION (live users): set META_WA_USE_TEMPLATES=true and create approved
 * templates in Meta Business Manager. Free-form text only works for test numbers
 * in dev mode, or within the 24h window after a user messages your business.
 *
 * Env:
 *   META_WA_PHONE_NUMBER_ID, META_WA_ACCESS_TOKEN, META_WA_API_VERSION
 *   META_WA_USE_TEMPLATES=true
 *   META_WA_TEMPLATE_OTP=carebridge_otp          (authentication / utility)
 *   META_WA_TEMPLATE_ALERT=carebridge_alert      (utility — notifications)
 *   META_WA_TEMPLATE_LANGUAGE=en
 */

const axios = require('axios');

const PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN;
const API_VERSION = process.env.META_WA_API_VERSION || 'v21.0';

const TEMPLATE_OTP = process.env.META_WA_TEMPLATE_OTP || '';
const TEMPLATE_ALERT = process.env.META_WA_TEMPLATE_ALERT || process.env.META_WA_TEMPLATE_UTILITY || '';
const TEMPLATE_LANG = process.env.META_WA_TEMPLATE_LANGUAGE || 'en';

/** Use templates when explicitly enabled or in production */
const USE_TEMPLATES =
  process.env.META_WA_USE_TEMPLATES === 'true' ||
  (process.env.NODE_ENV === 'production' && TEMPLATE_OTP);

const META_API_BASE = `https://graph.facebook.com/${API_VERSION}`;

const normalisePhone = (phone) => {
  if (!phone) return null;
  let p = phone.replace(/[\s\-()+]/g, '');
  if (p.startsWith('0092')) p = '92' + p.slice(4);
  else if (p.startsWith('03')) p = '92' + p.slice(1);
  else if (p.startsWith('3')) p = '92' + p;
  return '+' + p;
};

const toApiRecipient = (e164) => {
  if (!e164) return null;
  return String(e164).replace(/^\+/, '');
};

const isCredentialsMissing = () =>
  !PHONE_NUMBER_ID ||
  !ACCESS_TOKEN ||
  PHONE_NUMBER_ID === 'your_phone_number_id_here' ||
  ACCESS_TOKEN === 'your_meta_access_token_here';

const isWhatsAppConfigured = () => !isCredentialsMissing();

const isProductionWhatsAppReady = () =>
  isWhatsAppConfigured() && USE_TEMPLATES && Boolean(TEMPLATE_OTP && TEMPLATE_ALERT);

const textParams = (values) =>
  (values || []).map((text) => ({
    type: 'text',
    text: String(text ?? '').slice(0, 1024),
  }));

const buildTextPayload = (apiTo, bodyText) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: apiTo,
  type: 'text',
  text: { preview_url: false, body: bodyText },
});

const buildTemplatePayload = (apiTo, { name, language, bodyParams = [], headerParams = [], buttons = [] }) => {
  const components = [];
  if (headerParams.length) {
    components.push({ type: 'header', parameters: textParams(headerParams) });
  }
  if (bodyParams.length) {
    components.push({ type: 'body', parameters: textParams(bodyParams) });
  }
  for (const btn of buttons) {
    components.push(btn);
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: apiTo,
    type: 'template',
    template: {
      name,
      language: { code: language || TEMPLATE_LANG },
      ...(components.length ? { components } : {}),
    },
  };
};

/** Meta errors where free-text cannot reach this user — retry with template */
const shouldRetryWithTemplate = (errData) => {
  const code = errData?.error?.code;
  const subcode = errData?.error?.error_subcode;
  const msg = String(errData?.error?.message || '').toLowerCase();
  if ([131030, 131047, 131026, 131051, 470].includes(code)) return true;
  if (subcode === 2494040) return true;
  if (msg.includes('not in allowed list') || msg.includes('24 hour') || msg.includes('template')) return true;
  return false;
};

const postToMeta = async (apiTo, payload) => {
  const url = `${META_API_BASE}/${PHONE_NUMBER_ID}/messages`;
  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const messageId = response.data?.messages?.[0]?.id;
  const waId = response.data?.contacts?.[0]?.wa_id;
  return { success: true, messageId, waId, response: response.data, usedTemplate: payload.type === 'template' };
};

const resolveRecipient = (to) => {
  const e164 = normalisePhone(to);
  const apiTo = toApiRecipient(e164);
  if (!apiTo || apiTo.length < 10) {
    return { error: 'Invalid phone number', e164, apiTo };
  }
  return { e164, apiTo };
};

/**
 * Send an approved template message (required for live / non-test recipients).
 */
const sendWhatsAppTemplate = async (to, { name, language, bodyParams, headerParams, buttons }) => {
  if (!name) {
    return { success: false, error: 'Template name not configured' };
  }
  const { e164, apiTo, error } = resolveRecipient(to);
  if (error) {
    console.error('[META_WA] sendWhatsAppTemplate:', error, to);
    return { success: false, error };
  }

  if (isCredentialsMissing()) {
    console.log(`\n[META_WA MOCK TEMPLATE] to=${e164} template=${name} params=${JSON.stringify(bodyParams)}\n`);
    return { success: true, mocked: true, usedTemplate: true };
  }

  try {
    const payload = buildTemplatePayload(apiTo, { name, language, bodyParams, headerParams, buttons });
    const result = await postToMeta(apiTo, payload);
    console.log(
      `[META_WA] Template sent | template=${name} | to=${e164} | wa_id=${result.waId || 'n/a'} | id=${result.messageId}`
    );
    return result;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[META_WA] Template send error:', JSON.stringify(errData, null, 2));
    return { success: false, error: errData, template: name };
  }
};

/**
 * Send free-form text (dev test numbers or 24h window only).
 */
const sendWhatsApp = async (to, bodyText) => {
  if (!to) {
    return { success: false, error: 'Missing phone number' };
  }

  const { e164, apiTo, error } = resolveRecipient(to);
  if (error) {
    console.error('[META_WA] sendWhatsApp:', error, to);
    return { success: false, error };
  }

  if (isCredentialsMissing()) {
    console.log(`\n[META_WA MOCK TEXT] to=${e164}\n${bodyText}\n`);
    return { success: true, mocked: true };
  }

  const tryTemplateFallback = async (reason) => {
    if (!TEMPLATE_ALERT) {
      return {
        success: false,
        error: reason,
        hint: 'Set META_WA_USE_TEMPLATES=true and META_WA_TEMPLATE_ALERT in .env for live users.',
      };
    }
    const plain = bodyText.replace(/\*/g, '').slice(0, 900);
    console.log(`[META_WA] Falling back to template "${TEMPLATE_ALERT}" for ${e164}`);
    return sendWhatsAppTemplate(to, {
      name: TEMPLATE_ALERT,
      language: TEMPLATE_LANG,
      bodyParams: [plain],
    });
  };

  if (USE_TEMPLATES && TEMPLATE_ALERT) {
    return tryTemplateFallback('production template mode');
  }

  try {
    const payload = buildTextPayload(apiTo, bodyText);
    const result = await postToMeta(apiTo, payload);
    console.log(`[META_WA] Text sent | to=${e164} | id=${result.messageId}`);
    return result;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[META_WA] Text send error:', JSON.stringify(errData, null, 2));
    if (shouldRetryWithTemplate(errData)) {
      return tryTemplateFallback(errData);
    }
    return { success: false, error: errData };
  }
};

/**
 * OTP — uses authentication/utility template in production.
 * Create template in Meta with body like: "Your CareBridge code is {{1}}. Valid 10 minutes."
 */
const sendOtpWhatsApp = async (to, otp, name) => {
  if (USE_TEMPLATES && TEMPLATE_OTP) {
    const bodyParams = [String(otp)];
    if (process.env.META_WA_OTP_INCLUDE_NAME === 'true' && name) {
      bodyParams.unshift(String(name).slice(0, 60));
    }
    const buttons = [];
    if (process.env.META_WA_OTP_COPY_CODE === 'true') {
      buttons.push({
        type: 'button',
        sub_type: 'copy_code',
        index: 0,
        parameters: [{ type: 'coupon_code', coupon_code: String(otp) }],
      });
    }
    return sendWhatsAppTemplate(to, {
      name: TEMPLATE_OTP,
      language: TEMPLATE_LANG,
      bodyParams: process.env.META_WA_OTP_INCLUDE_NAME === 'true' ? bodyParams : [String(otp)],
      buttons,
    });
  }

  const text =
    `CareBridge Health — Verification Code\n\n` +
    `Hi ${name},\n\n` +
    `Your code is: ${otp}\n\n` +
    `Expires in 10 minutes. Do not share this code.`;

  return sendWhatsApp(to, text);
};

module.exports = {
  sendWhatsApp,
  sendWhatsAppTemplate,
  sendOtpWhatsApp,
  normalisePhone,
  toApiRecipient,
  isWhatsAppConfigured,
  isProductionWhatsAppReady,
  USE_TEMPLATES,
};
