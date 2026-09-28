'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { api, clearSession } from '@/lib/api';

type Me = {
  id: string;
  name: string;
  phone: string | null;
  otpEnabled: boolean;
  whatsappReady: boolean;
};

type Challenge = { challengeId: string; phoneHint: string };

type Status = { text: string; tone?: 'error' | 'success' } | null;

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2';

export default function SecurityPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [phone, setPhone] = useState('');
  const [phonePassword, setPhonePassword] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<Status>(null);
  const [offPassword, setOffPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Status>(null);

  const load = useCallback(async () => {
    try {
      const user = await api<Me>('/auth/me');
      setMe(user);
      setPhone(user.phone || '');
    } catch {
      clearSession();
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Something went wrong',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  function savePhone(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          phone: phone.trim(),
          currentPassword: phonePassword,
        }),
      });
      setPhonePassword('');
      setChallenge(null);
      await load();
      setMessage({
        text: me?.otpEnabled
          ? 'WhatsApp number saved. Login codes were turned off — turn them on again for the new number.'
          : 'WhatsApp number saved.',
        tone: 'success',
      });
    });
  }

  function sendCode() {
    void run(async () => {
      const c = await api<Challenge>('/auth/otp/start', { method: 'POST' });
      setChallenge(c);
      setCode('');
      setCodeStatus({ text: `Code sent by WhatsApp to ${c.phoneHint}.` });
    });
  }

  async function confirmCode() {
    if (!challenge || busy) return;
    if (!/^\d{6}$/.test(code)) {
      setCodeStatus({ text: 'Code must contain 6 digits.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await api('/auth/otp/confirm', {
        method: 'POST',
        body: JSON.stringify({ challengeId: challenge.challengeId, code }),
      });
      setChallenge(null);
      setCode('');
      await load();
      setMessage({
        text: 'WhatsApp login codes are ON. You will need a code each time you sign in.',
        tone: 'success',
      });
    } catch (err) {
      setCode('');
      setCodeStatus({
        text: err instanceof Error ? err.message : 'Invalid code.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  function turnOff(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api('/auth/otp/disable', {
        method: 'POST',
        body: JSON.stringify({ password: offPassword }),
      });
      setOffPassword('');
      await load();
      setMessage({ text: 'WhatsApp login codes are OFF.', tone: 'success' });
    });
  }

  const savedPhone = me?.phone || '';
  const phoneChanged = phone.trim() !== savedPhone;

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-slate-900">Login security</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-500">
        Optional: after your password, get a 6-digit code on WhatsApp each time
        you sign in. Someone who learns your password still cannot get in
        without your phone.
      </p>

      {message ? (
        <p
          className={`mt-4 max-w-xl text-sm ${
            message.tone === 'error' ? 'text-red-600' : 'text-teal-700'
          }`}
          role={message.tone === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}

      <section className="mt-6 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">
            WhatsApp login code
          </h2>
          {me ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                me.otpEnabled
                  ? 'bg-teal-100 text-teal-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {me.otpEnabled ? 'ON' : 'OFF'}
            </span>
          ) : null}
        </div>

        <form onSubmit={savePhone} className="space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600">Your WhatsApp Number</span>
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 50 123 4567"
              autoComplete="tel"
            />
          </label>
          {phoneChanged ? (
            <>
              <label className="block text-sm">
                <span className="text-slate-600">Current password</span>
                <input
                  className={inputClass}
                  type="password"
                  value={phonePassword}
                  onChange={(e) => setPhonePassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg border border-blue-600 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
              >
                Save WhatsApp number
              </button>
            </>
          ) : null}
        </form>

        {me && !me.otpEnabled ? (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            {!me.whatsappReady ? (
              <p className="text-sm text-amber-700">
                Automatic WhatsApp sending is not connected yet, so codes cannot
                be delivered. Ask the Super admin to connect it in Settings.
              </p>
            ) : !savedPhone ? (
              <p className="text-sm text-slate-600">
                Save your WhatsApp number first.
              </p>
            ) : challenge ? (
              <>
                <p className="text-sm text-slate-600">
                  Enter the code we sent to confirm this number.
                </p>
                <OtpCodeInput
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    setCodeStatus(null);
                  }}
                  onSubmit={() => void confirmCode()}
                  disabled={busy}
                  status={codeStatus}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void confirmCode()}
                    disabled={busy || code.length !== 6}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                  >
                    {busy ? 'Checking…' : 'Verify & turn on'}
                  </button>
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={busy}
                    className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 disabled:opacity-60"
                  >
                    Resend
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={sendCode}
                disabled={busy || phoneChanged}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Turn on — send me a code'}
              </button>
            )}
          </div>
        ) : null}

        {me?.otpEnabled ? (
          <form
            onSubmit={turnOff}
            className="space-y-3 border-t border-slate-200 pt-4"
          >
            <label className="block text-sm">
              <span className="text-slate-600">
                Password (to turn login codes off)
              </span>
              <input
                className={inputClass}
                type="password"
                value={offPassword}
                onChange={(e) => setOffPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-blue-50 disabled:opacity-60"
            >
              Turn off
            </button>
          </form>
        ) : null}
      </section>
    </AppShell>
  );
}
