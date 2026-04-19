export const PASSWORD_MIN_LENGTH = 8;

/** @typedef {{ id: string, label: string, test: (p: string) => boolean }} PasswordRule */

/** @type {PasswordRule[]} */
export const PASSWORD_REQUIREMENTS = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'upper',
    label: 'One uppercase letter (A–Z)',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lower',
    label: 'One lowercase letter (a–z)',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'number',
    label: 'One number (0–9)',
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: 'special',
    label: 'One special character (e.g. ! @ # $ %)',
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export function passwordMeetsAllRules(password) {
  if (!password) return false;
  return PASSWORD_REQUIREMENTS.every((r) => r.test(password));
}

export function getPasswordRuleStates(password) {
  const p = password ?? '';
  return PASSWORD_REQUIREMENTS.map((r) => ({
    id: r.id,
    label: r.label,
    met: r.test(p),
  }));
}
