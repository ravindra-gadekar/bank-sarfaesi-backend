import { Branch, ISsoConfig } from '../../branch/models/branch.model';

interface SsoResolution {
  provider: 'microsoft' | 'google' | 'otp';
  branchId?: string;
  authUrl?: string;
}

interface CacheEntry {
  result: SsoResolution;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const domainCache = new Map<string, CacheEntry>();

const ssoResolverService = {
  async resolveProvider(email: string): Promise<SsoResolution> {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      return { provider: 'otp' };
    }

    // Check in-memory cache
    const cached = domainCache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    // Query branches for SSO config matching this domain
    const branch = await Branch.findOne({
      'ssoConfigs.allowedDomains': domain,
    }).exec();

    if (!branch || !branch.ssoConfigs || branch.ssoConfigs.length === 0) {
      const result: SsoResolution = { provider: 'otp' };
      domainCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }

    const matchingConfig = (branch.ssoConfigs as ISsoConfig[]).find(
      (config) => config.allowedDomains?.includes(domain),
    );

    if (!matchingConfig) {
      const result: SsoResolution = { provider: 'otp' };
      domainCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }

    const result: SsoResolution = {
      provider: matchingConfig.provider,
      branchId: branch._id.toString(),
    };

    domainCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  },
};

export { ssoResolverService };
export type { SsoResolution };
