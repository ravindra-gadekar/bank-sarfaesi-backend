import ChatFlowConfig, { IChatFlowConfig, IQuestionNode } from '../models/chatFlowConfig.model';
import { ApiError } from '../../common/utils/apiError';
import { validateChatFlowConfig } from './configValidation.service';

const chatFlowService = {
  // ── Read ──────────────────────────────────────────────

  async getActiveConfig(branchId: string, noticeType: string): Promise<IChatFlowConfig> {
    // Try branch-specific config first
    const branchConfig = await ChatFlowConfig.findOne({
      branchId,
      noticeType,
      isActive: true,
    }).sort({ version: -1 });

    if (branchConfig) return branchConfig;

    // Fallback to global default
    const globalConfig = await ChatFlowConfig.findOne({
      branchId: null,
      noticeType,
      isActive: true,
    }).sort({ version: -1 });

    if (globalConfig) return globalConfig;

    throw ApiError.notFound(`No active chat flow config found for notice type: ${noticeType}`);
  },

  /** List all configs visible to a branch (branch-specific + global defaults). */
  async listConfigs(branchId: string): Promise<IChatFlowConfig[]> {
    const configs = await ChatFlowConfig.find({
      $or: [{ branchId }, { branchId: null }],
    })
      .sort({ noticeType: 1, version: -1 })
      .lean();
    return configs as IChatFlowConfig[];
  },

  /** Get a single config by ID (must belong to branch or be global). */
  async getConfigById(branchId: string, configId: string): Promise<IChatFlowConfig> {
    const config = await ChatFlowConfig.findById(configId);
    if (!config) throw ApiError.notFound('Chat flow config not found.');

    // Security: only allow access to own branch configs or global defaults
    if (config.branchId && config.branchId.toString() !== branchId) {
      throw ApiError.forbidden('Access denied to this config.');
    }
    return config;
  },

  /** Get all versions for a (branchId, noticeType) pair. */
  async getVersionHistory(branchId: string, noticeType: string): Promise<IChatFlowConfig[]> {
    const versions = await ChatFlowConfig.find({
      branchId,
      noticeType,
    })
      .sort({ version: -1 })
      .lean();
    return versions as IChatFlowConfig[];
  },

  // ── Create / Clone ────────────────────────────────────

  /** Clone the global default config as a new branch-specific config (v1). */
  async cloneFromDefault(branchId: string, noticeType: string): Promise<IChatFlowConfig> {
    // Check if branch already has an active config for this type
    const existing = await ChatFlowConfig.findOne({
      branchId,
      noticeType,
      isActive: true,
    });
    if (existing) {
      throw ApiError.conflict('Branch already has an active config for this notice type. Edit the existing one instead.');
    }

    const globalConfig = await ChatFlowConfig.findOne({
      branchId: null,
      noticeType,
      isActive: true,
    }).sort({ version: -1 });

    if (!globalConfig) {
      throw ApiError.notFound(`No global default config found for notice type: ${noticeType}`);
    }

    const config = await ChatFlowConfig.create({
      branchId,
      noticeType,
      version: 1,
      questionFlow: globalConfig.questionFlow,
      keywordAnswerMap: globalConfig.keywordAnswerMap,
      isActive: true,
      effectiveFrom: new Date(),
    });

    return config;
  },

  // ── Update ────────────────────────────────────────────

  /** Update a config — creates a new version, deactivates the old one. */
  async updateConfig(
    branchId: string,
    configId: string,
    data: { questionFlow?: IQuestionNode[]; keywordAnswerMap?: Record<string, string> },
  ): Promise<IChatFlowConfig> {
    const existing = await ChatFlowConfig.findById(configId);
    if (!existing) throw ApiError.notFound('Chat flow config not found.');
    if (existing.branchId && existing.branchId.toString() !== branchId) {
      throw ApiError.forbidden('Cannot edit configs belonging to another branch.');
    }
    // Cannot edit global defaults directly — must clone first
    if (!existing.branchId) {
      throw ApiError.forbidden('Cannot edit global default configs. Clone to your branch first.');
    }

    const newFlow = data.questionFlow ?? existing.questionFlow;
    const newKAM = data.keywordAnswerMap ?? (existing.keywordAnswerMap as Record<string, string>);

    // Validate before saving
    const validation = validateChatFlowConfig(newFlow, newKAM);
    if (!validation.valid) {
      throw ApiError.badRequest(`Config validation failed: ${validation.errors.join('; ')}`);
    }

    // Deactivate the current version
    existing.isActive = false;
    await existing.save();

    // Create new version
    const config = await ChatFlowConfig.create({
      branchId: existing.branchId,
      noticeType: existing.noticeType,
      version: existing.version + 1,
      questionFlow: newFlow,
      keywordAnswerMap: newKAM,
      isActive: true,
      effectiveFrom: new Date(),
    });

    return config;
  },

  // ── Activate ──────────────────────────────────────────

  /** Activate a specific version (deactivates any other active version for same branch+type). */
  async activateConfig(branchId: string, configId: string): Promise<IChatFlowConfig> {
    const config = await ChatFlowConfig.findById(configId);
    if (!config) throw ApiError.notFound('Chat flow config not found.');
    if (config.branchId && config.branchId.toString() !== branchId) {
      throw ApiError.forbidden('Cannot activate configs belonging to another branch.');
    }
    if (!config.branchId) {
      throw ApiError.forbidden('Cannot activate global defaults directly.');
    }

    // Deactivate all versions for this branch + notice type
    await ChatFlowConfig.updateMany(
      { branchId: config.branchId, noticeType: config.noticeType, isActive: true },
      { isActive: false },
    );

    config.isActive = true;
    config.effectiveFrom = new Date();
    await config.save();

    return config;
  },

  // ── Legacy upsert (kept for seed runner) ──────────────

  async upsertConfig(
    branchId: string | null,
    noticeType: string,
    data: Partial<IChatFlowConfig>,
  ): Promise<IChatFlowConfig> {
    const existing = await ChatFlowConfig.findOne({
      branchId,
      noticeType,
      isActive: true,
    }).sort({ version: -1 });

    const nextVersion = existing ? existing.version + 1 : 1;

    // Deactivate previous active config
    if (existing) {
      existing.isActive = false;
      await existing.save();
    }

    const config = await ChatFlowConfig.create({
      ...data,
      branchId,
      noticeType,
      version: nextVersion,
      isActive: true,
    });

    return config;
  },
};

export { chatFlowService };
