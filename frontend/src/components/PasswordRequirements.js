import React from 'react';
import { getPasswordRuleStates } from '../utils/passwordRules';

/**
 * Live checklist for password complexity (register, reset, change password).
 */
export default function PasswordRequirements({ password, id = 'password-requirements' }) {
  const rules = getPasswordRuleStates(password);

  return (
    <ul
      id={id}
      className="mt-2 space-y-1 rounded-md border border-gray-100 bg-gray-50/80 px-2.5 py-2 text-left"
      aria-label="Password requirements"
      aria-live="polite"
    >
      {rules.map(({ id: key, label, met }) => (
        <li
          key={key}
          className={`flex items-start gap-2 text-xs leading-snug ${met ? 'text-green-700' : 'text-gray-600'}`}
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            {met ? (
              <svg className="h-3.5 w-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-3 w-3 mt-px text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <circle cx="12" cy="12" r="8" strokeWidth="2" />
              </svg>
            )}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
