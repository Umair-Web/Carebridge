# WhatsApp — Go Live (Production)

## Why test numbers receive messages but real users do not

In **Development** mode, Meta only **delivers** free-form messages to phone numbers added as **test recipients** in the developer app.

For **any real user** (e.g. `03123740084`), you must:

1. Complete **Meta Business Verification**
2. Set the WhatsApp product to **Live** (not Development)
3. Send messages using **approved Message Templates** (not plain text)

The API can return `success` + `messageId` even when the message is **not delivered** to non-test numbers in dev mode.

---

## Step 1 — Meta Business setup

1. [Meta Business Manager](https://business.facebook.com) → your business
2. **WhatsApp Manager** → add / verify phone number
3. **Settings** → complete **Business verification**
4. In [developers.facebook.com](https://developers.facebook.com) → your app → **WhatsApp** → switch app / number to **Live**

---

## Step 2 — Create message templates

**WhatsApp Manager** → **Account tools** → **Message templates** → **Create template**

### A) OTP template (Authentication or Utility)

- **Name:** `carebridge_otp` (must match `.env`)
- **Category:** Authentication (recommended) or Utility
- **Language:** English
- **Body example:**

  ```
  Your CareBridge verification code is {{1}}. It expires in 10 minutes. Do not share this code.
  ```

- Submit for approval (usually minutes to 24 hours)

### B) Alert / notification template (Utility)

- **Name:** `carebridge_alert`
- **Category:** Utility
- **Body example:**

  ```
  CareBridge Health: {{1}}
  ```

- `{{1}}` = notification text (referral, login, settlement, admin broadcast)

---

## Step 3 — Backend `.env`

```env
META_WA_PHONE_NUMBER_ID=your_phone_number_id
META_WA_ACCESS_TOKEN=your_permanent_system_user_token
META_WA_API_VERSION=v21.0

# Production messaging
META_WA_USE_TEMPLATES=true
META_WA_TEMPLATE_OTP=carebridge_otp
META_WA_TEMPLATE_ALERT=carebridge_alert
META_WA_TEMPLATE_LANGUAGE=en

# Optional: OTP template has {{1}}=name and {{2}}=code
# META_WA_OTP_INCLUDE_NAME=true

# Optional: add copy-code button (authentication templates)
# META_WA_OTP_COPY_CODE=true
```

Restart the backend after changes.

---

## Step 4 — Verify

```bash
cd backend
node scripts/send-wa-test.js 03123740084
```

Check `GET /v1/admin/whatsapp/status` (admin) — should show `productionReady: true`.

---

## Step 5 — Webhooks (recommended)

In Meta app → **WhatsApp** → **Configuration** → **Webhook**:

- URL: `https://your-api.com/v1/webhooks/whatsapp`
- Subscribe: `messages`, `message_template_status_update`

Implement delivery/read receipts later to confirm `delivered` vs `failed`.

---

## Template names must match exactly

Template **name** in Meta (lowercase, underscores) must equal `META_WA_TEMPLATE_OTP` and `META_WA_TEMPLATE_ALERT`.

If Meta rejects a template, fix copy and resubmit — the app cannot send until status is **Approved**.
