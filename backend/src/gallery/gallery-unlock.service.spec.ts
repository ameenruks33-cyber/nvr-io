import { GalleryUnlockService } from './gallery-unlock.service';

describe('GalleryUnlockService tokens', () => {
  it('issues and verifies a user-bound unlock token', () => {
    const svc = Object.create(GalleryUnlockService.prototype) as GalleryUnlockService;
    (svc as unknown as { secret: string }).secret = 'test-secret-key-for-gallery';
    const token = svc.issueToken('user-1');
    expect(svc.verifyToken('user-1', token)).toBe(true);
    expect(svc.verifyToken('user-2', token)).toBe(false);
    expect(svc.verifyToken('user-1', 'bad.token.here')).toBe(false);
  });
});
