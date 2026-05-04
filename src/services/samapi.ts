import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE = process.env.SAM_API_BASE || 'https://www.sam-api.pro/api';

function getHeaders() {
  const sid = (process.env.SAM_SID || '').trim();
  if (!sid) {
    console.error('SAM_SID is missing from environment variables!');
  }

  let cookieValue = sid;
  if (sid && !sid.includes('=')) {
    cookieValue = `sam_sid=${sid}`;
  }

  return {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Cookie': cookieValue,
    'Origin': 'https://www.sam-api.pro',
    'Referer': 'https://www.sam-api.pro/wallets/add/shamcash',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
  };
}

/**
 * Normalize QR session response from SAM API into a consistent format.
 * SAM API may return the QR payload in different shapes; we handle all known ones.
 */
function normalizeQRSession(data: any): {
  id: string;
  qrPayload: string;
  status: string;
  expiresAt: string;
} {
  console.log('[SAM API] Raw QR session response:', JSON.stringify(data, null, 2));

  // Handle nested data wrapper
  const session = data?.data ?? data?.session ?? data;

  const id = session?.id ?? session?.sessionId ?? session?.session_id;
  const status = session?.status ?? 'pending';

  // ExpiresAt: try multiple possible field names
  const expiresAt =
    session?.expiresAt ??
    session?.expires_at ??
    session?.expiredAt ??
    session?.expired_at ??
    new Date(Date.now() + 3 * 60 * 1000).toISOString();

  // QR Payload extraction
  let qrPayload: string;

  if (session?.qrPayload && typeof session.qrPayload === 'string') {
    qrPayload = session.qrPayload;
  } else if (session?.qr_payload && typeof session.qr_payload === 'string') {
    qrPayload = session.qr_payload;
  } else if (session?.qrCode && typeof session.qrCode === 'string') {
    qrPayload = session.qrCode;
  } else if (session?.qr_code && typeof session.qr_code === 'string') {
    qrPayload = session.qr_code;
  } else if (session?.sessionId || session?.publicKey) {
    // Build the QR payload from structured fields (matches the format shamcash expects)
    qrPayload = JSON.stringify({
      sessionId: session.sessionId ?? id,
      publicKey: session.publicKey ?? '',
      infoDevice: session.infoDevice ?? {
        deviceName: 'SAMAPI',
        os: 'Linux',
        browser: 'chrome'
      }
    });
  } else {
    qrPayload = JSON.stringify(session);
  }

  if (!id) {
    console.error('[SAM API] Could not extract session ID from response:', data);
    throw new Error('SAM API returned no session ID');
  }

  console.log('[SAM API] Normalized QR session:', { id, status, expiresAt, qrPayload });

  return { id, qrPayload, status, expiresAt };
}

/**
 * Normalize QR session status response.
 */
function normalizeQRStatus(data: any): {
  status: string;
  walletAccountId?: string;
} {
  const session = data?.data ?? data?.session ?? data;

  const status = session?.status ?? 'pending';
  const walletAccountId =
    session?.walletAccountId ??
    session?.wallet_account_id ??
    session?.walletId ??
    session?.wallet_id ??
    undefined;

  return { status, walletAccountId };
}

export async function createQRSession() {
  try {
    const res = await axios.post(
      `${BASE}/qr-sessions`,
      { provider: 'shamcash' },
      { headers: getHeaders() }
    );
    return normalizeQRSession(res.data);
  } catch (error: any) {
    if (error.response?.status === 401) {
      const apiError = error.response?.data;
      console.error('[SAM API] AUTH FAILURE:', apiError || error.message);
      throw new Error(apiError?.message || apiError?.error || 'UNAUTHENTICATED');
    }
    throw error;
  }
}

export async function checkQRSession(samSessionId: string) {
  try {
    const res = await axios.get(
      `${BASE}/qr-sessions/${samSessionId}`,
      { headers: getHeaders() }
    );
    return normalizeQRStatus(res.data);
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('UNAUTHENTICATED');
    }
    throw error;
  }
}

export async function getWallets() {
  const res = await axios.get(`${BASE}/wallets`, { headers: getHeaders() });
  return res.data;
}

export async function getBalance(samWalletId: string) {
  const res = await axios.get(
    `${BASE}/wallets/${samWalletId}/balance`,
    { headers: getHeaders() }
  );
  return res.data;
}

export async function getTransactions(samWalletId: string) {
  const res = await axios.get(
    `${BASE}/wallets/${samWalletId}/transactions`,
    { headers: getHeaders() }
  );
  return res.data;
}
