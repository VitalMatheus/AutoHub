function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCpfCnpj(value: string): string {
  const digits = digitsOnly(value).slice(0, 14);

  if (digits.length <= 11) {
    const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
    const formatted = parts.join('.');
    return digits.length > 9 ? `${formatted}-${digits.slice(9)}` : formatted;
  }

  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 8)].filter(Boolean);
  const formatted = parts.join('.');
  const suffix = digits.slice(8);
  return suffix.length > 4 ? `${formatted}/${suffix.slice(0, 4)}-${suffix.slice(4)}` : `${formatted}/${suffix}`;
}

export function formatPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : '';

  const areaCode = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  if (digits.length === 11) return `(${areaCode}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}`;

  const formattedSubscriber = subscriber.length > 4 ? `${subscriber.slice(0, 4)}-${subscriber.slice(4)}` : subscriber;
  return `(${areaCode}) ${formattedSubscriber}`;
}
