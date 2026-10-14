import { parseStickyWalletLines } from './sticky-wallet-lines';

describe('parseStickyWalletLines', () => {
  it('parses name and amount on one line', () => {
    expect(
      parseStickyWalletLines('@ Ahmed Ali 800\nOther note without at'),
    ).toEqual([{ name: 'Ahmed Ali', amount: 800 }]);
  });

  it('parses customer code and dash separator', () => {
    expect(parseStickyWalletLines('@ JB-CUS-000003 - 100')).toEqual([
      { name: 'JB-CUS-000003', amount: 100 },
    ]);
  });

  it('ignores lines without a trailing amount', () => {
    expect(parseStickyWalletLines('@ Ahmed only')).toEqual([]);
  });
});
