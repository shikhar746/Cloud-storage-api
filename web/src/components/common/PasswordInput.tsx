import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Rendered inside the field on the left, e.g. a lock glyph. */
  leftIcon?: React.ReactNode;
  /** Classes for the positioning wrapper — `flex-1` when the field sits in a row. */
  wrapperClassName?: string;
}

/**
 * A password field with a reveal toggle.
 *
 * Padding is supplied here rather than by callers: two competing `pr-*`
 * utilities would resolve by stylesheet order rather than by the order they
 * appear in the class string, so the text could end up running underneath the
 * button. Callers pass everything except horizontal padding.
 */
export const PasswordInput: React.FC<PasswordInputProps> = ({
  leftIcon,
  wrapperClassName = '',
  className = '',
  ...inputProps
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      {leftIcon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {leftIcon}
        </div>
      )}

      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={`${className} ${leftIcon ? 'pl-9' : 'pl-3.5'} pr-10`}
      />

      <button
        // type="button" matters: every one of these sits inside a form, and the
        // default submit type would post the form on each reveal
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-300 focus:text-gray-300 focus:outline-none transition-colors cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};
