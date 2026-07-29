'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/client/components/ui';

interface Reference {
  countries: Array<{ countryId: number; countryName: string }>;
  securityQuestions: Array<{ securityQuestionId: number; question: string }>;
}

export function RegisterForm() {
  const router = useRouter();

  const [references, setReferences] = React.useState<Reference>({ countries: [], securityQuestions: [] });
  const [states, setStates] = React.useState<Array<{ stateId: number; stateName: string }>>([]);
  const [cities, setCities] = React.useState<Array<{ cityId: number; cityName: string }>>([]);

  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    countryId: '',
    stateId: '',
    cityId: '',
    securityQuestionId: '',
    securityAnswer: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  React.useEffect(() => {
    fetch('/api/news/sources')
      .then((r) => r.json())
      .then((data) => setReferences({ countries: data.countries ?? [], securityQuestions: data.securityQuestions ?? [] }))
      .catch(() => setError('Could not load the registration form options. Please refresh.'));
  }, []);

  React.useEffect(() => {
    if (!form.countryId) return;
    fetch(`/api/news/sources?countryId=${form.countryId}`)
      .then((r) => r.json())
      .then((data) => setStates(data.states ?? []))
      .catch(() => setStates([]));
  }, [form.countryId]);

  React.useEffect(() => {
    if (!form.stateId) return;
    fetch(`/api/news/sources?stateId=${form.stateId}`)
      .then((r) => r.json())
      .then((data) => setCities(data.cities ?? []))
      .catch(() => setCities([]));
  }, [form.stateId]);

  const passwordMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const passwordTooShort = form.password.length > 0 && form.password.length < 8;
  const mobileInvalid = form.mobileNumber.length > 0 && !/^\d{10}$/.test(form.mobileNumber);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (passwordMismatch) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Registration failed.');
        return;
      }

      router.push('/login?registered=1');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card elevated>
      <CardHeader title="Create an account" description="Saves your verification history across devices." />
      <CardBody>
        <form onSubmit={submit} className="stack stack-5">
          {error && (
            <Alert tone="error" title="Could not create your account">
              {error}
            </Alert>
          )}

          <div className="grid-12" style={{ gap: 'var(--space-4)' }}>
            <div style={{ gridColumn: 'span 6' }}>
              <Field label="First name" required>
                {(props) => (
                  <Input {...props} value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} required />
                )}
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6' }}>
              <Field label="Last name" required>
                {(props) => (
                  <Input {...props} value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} required />
                )}
              </Field>
            </div>
          </div>

          <Field label="Email address" required>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
                autoComplete="email"
                required
              />
            )}
          </Field>

          <Field
            label="Mobile number"
            hint="10 digits, no spaces."
            error={mobileInvalid ? 'Enter exactly 10 digits.' : undefined}
            required
          >
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={form.mobileNumber}
                onChange={(e) => set('mobileNumber')(e.target.value.replace(/\D/g, '').slice(0, 10))}
                invalid={mobileInvalid}
                required
              />
            )}
          </Field>

          <div className="grid-12" style={{ gap: 'var(--space-4)' }}>
            <div style={{ gridColumn: 'span 4' }}>
              <Field label="Country" required>
                {(props) => (
                  <Select {...props} value={form.countryId} onChange={(e) => set('countryId')(e.target.value)} required>
                    <option value="">Select…</option>
                    {references.countries.map((c) => (
                      <option key={c.countryId} value={c.countryId}>
                        {c.countryName}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <Field label="State" required>
                {(props) => (
                  <Select
                    {...props}
                    value={form.stateId}
                    onChange={(e) => set('stateId')(e.target.value)}
                    disabled={!form.countryId}
                    required
                  >
                    <option value="">Select…</option>
                    {states.map((state) => (
                      <option key={state.stateId} value={state.stateId}>
                        {state.stateName}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <Field label="City" required>
                {(props) => (
                  <Select
                    {...props}
                    value={form.cityId}
                    onChange={(e) => set('cityId')(e.target.value)}
                    disabled={!form.stateId}
                    required
                  >
                    <option value="">Select…</option>
                    {cities.map((city) => (
                      <option key={city.cityId} value={city.cityId}>
                        {city.cityName}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </div>

          <Field label="Security question" required>
            {(props) => (
              <Select
                {...props}
                value={form.securityQuestionId}
                onChange={(e) => set('securityQuestionId')(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {references.securityQuestions.map((q) => (
                  <option key={q.securityQuestionId} value={q.securityQuestionId}>
                    {q.question}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Security answer"
            hint="Used to reset your password. Stored hashed, never in readable form."
            required
          >
            {(props) => (
              <Input
                {...props}
                value={form.securityAnswer}
                onChange={(e) => set('securityAnswer')(e.target.value)}
                required
              />
            )}
          </Field>

          <div className="grid-12" style={{ gap: 'var(--space-4)' }}>
            <div style={{ gridColumn: 'span 6' }}>
              <Field
                label="Password"
                hint="At least 8 characters."
                error={passwordTooShort ? 'Must be at least 8 characters.' : undefined}
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    type="password"
                    value={form.password}
                    onChange={(e) => set('password')(e.target.value)}
                    autoComplete="new-password"
                    invalid={passwordTooShort}
                    required
                  />
                )}
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6' }}>
              <Field
                label="Confirm password"
                error={passwordMismatch ? 'Passwords do not match.' : undefined}
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword')(e.target.value)}
                    autoComplete="new-password"
                    invalid={passwordMismatch}
                    required
                  />
                )}
              </Field>
            </div>
          </div>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Create account
          </Button>

          <p className="text-sm muted" style={{ textAlign: 'center' }}>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
