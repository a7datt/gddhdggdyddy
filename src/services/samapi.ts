import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE = process.env.SAM_API_BASE || 'https://www.sam-api.pro/api';

function getHeaders() {
  const sid = (process.env.SAM_SID || '').trim();
  if (!sid) {
    console.error('SAM_SID is missing from environment variables!');
  }
  
  // Clean the SID: if it's a full cookie string, extract just the value, or prepend sam_sid= if missing
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

export async function createQRSession() {
  try {
    const res = await axios.post(`${BASE}/qr-sessions`,
      { provider: 'shamcash' },
      { headers: getHeaders() }
    );
    return res.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      const apiError = error.response?.data;
      console.error('SAM_API AUTH FAILURE:', apiError || error.message);
      throw new Error(apiError?.message || apiError?.error || 'UNAUTHENTICATED');
    }
    throw error;
  }
}

export async function checkQRSession(samSessionId: string) {
  const res = await axios.get(`${BASE}/qr-sessions/${samSessionId}`,
    { headers: getHeaders() }
  );
  return res.data;
}

export async function getWallets() {
  const res = await axios.get(`${BASE}/wallets`, { headers: getHeaders() });
  return res.data;
}

export async function getBalance(samWalletId: string) {
  const res = await axios.get(`${BASE}/wallets/${samWalletId}/balance`,
    { headers: getHeaders() }
  );
  return res.data;
}

export async function getTransactions(samWalletId: string) {
  const res = await axios.get(`${BASE}/wallets/${samWalletId}/transactions`,
    { headers: getHeaders() }
  );
  return res.data;
}
