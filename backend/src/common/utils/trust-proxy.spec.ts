import { resolveTrustProxy } from './trust-proxy';

describe('resolveTrustProxy', () => {
  it('trusts nothing when the variable is unset', () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
    expect(resolveTrustProxy('')).toBe(false);
  });

  it('trusts nothing when it is switched off explicitly', () => {
    expect(resolveTrustProxy('false')).toBe(false);
  });

  it('reads a hop count as a number', () => {
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy('2')).toBe(2);
    expect(resolveTrustProxy('0')).toBe(0);
  });

  it('trusts every hop when asked to', () => {
    expect(resolveTrustProxy('true')).toBe(true);
  });

  it('passes an address or preset through to express', () => {
    expect(resolveTrustProxy('loopback')).toBe('loopback');
    expect(resolveTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
  });

  it('does not read a fractional or negative hop count as a number', () => {
    expect(resolveTrustProxy('1.5')).toBe('1.5');
    expect(resolveTrustProxy('-1')).toBe('-1');
  });
});
