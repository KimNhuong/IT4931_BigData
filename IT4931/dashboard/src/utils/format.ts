export const formatCurrency = (value: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value);
};

export const formatCompactNumber = (value: number) => {
  const formatter = Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return formatter.format(value);
};

export const formatPrice = (price: number | null | undefined) => {
  if (price === null || price === undefined) return '---';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};
