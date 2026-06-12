const VN_PHONE = /^0(3|5|7|8|9)\d{8}$/;

export function isValidVnPhone(phone: string): boolean {
  const digits = phone.replace(/\s/g, "");
  return VN_PHONE.test(digits);
}