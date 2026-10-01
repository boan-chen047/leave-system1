import { describe, it, expect } from 'vitest';
import { BANK_CODES, normalizeDigits, validateBankCode, validateBankAccount } from '#shared/utils/banks';

describe('banks', () => {
  it('清單皆為 3 碼數字、代號不重複', () => {
    for (const b of BANK_CODES) {
      expect(b.code).toMatch(/^\d{3}$/);
      expect(b.name.length).toBeGreaterThan(0);
    }
    const codes = BANK_CODES.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    // 委託人提到的中國信託 822 要在清單裡（退費 -15 元判斷相關）
    expect(codes).toContain('822');
  });

  it('normalizeDigits 去掉空白與連字號', () => {
    expect(normalizeDigits('1234-5678')).toBe('12345678');
    expect(normalizeDigits(' 001 234 ')).toBe('001234');
  });

  describe('validateBankCode', () => {
    it('3～7 位數字通過', () => {
      expect(validateBankCode('822')).toBeNull();
      expect(validateBankCode('8220123')).toBeNull(); // 含分行 7 碼
      expect(validateBankCode(' 004 ')).toBeNull(); // 去空白後 3 碼
    });
    it('空、太短、太長、含非數字擋下', () => {
      expect(validateBankCode('')).toBe('請填銀行代號');
      expect(validateBankCode('12')).toBe('銀行代號應為 3～7 位數字');
      expect(validateBankCode('12345678')).toBe('銀行代號應為 3～7 位數字');
      expect(validateBankCode('82a')).toBe('銀行代號應為 3～7 位數字');
    });
  });

  describe('validateBankAccount', () => {
    it('5～20 位數字通過（允許空白/連字號）', () => {
      expect(validateBankAccount('12345')).toBeNull();
      expect(validateBankAccount('1234-5678-9012')).toBeNull();
      expect(validateBankAccount('12345678901234567890')).toBeNull(); // 20 碼
    });
    it('空、太短、太長、含非數字擋下', () => {
      expect(validateBankAccount('')).toBe('請填銀行帳號');
      expect(validateBankAccount('1234')).toBe('帳號應為 5～20 位數字');
      expect(validateBankAccount('123456789012345678901')).toBe('帳號應為 5～20 位數字'); // 21 碼
      expect(validateBankAccount('1234a')).toBe('帳號應為 5～20 位數字');
    });
  });
});
