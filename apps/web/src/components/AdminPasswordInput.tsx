'use client';

import { getSession } from '@/lib/api';
import { isAdminRole } from '@/lib/roles';
import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { PasswordInput } from '@/components/PasswordInput';

type AdminPasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

/** Password field; show/hide eye appears only for Admin and Super admin (signed in). */
export function AdminPasswordInput(props: AdminPasswordInputProps) {
  const [showToggle, setShowToggle] = useState(false);

  useEffect(() => {
    setShowToggle(isAdminRole(getSession()?.user.role));
  }, []);

  return <PasswordInput showToggle={showToggle} {...props} />;
}
