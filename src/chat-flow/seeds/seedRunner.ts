import ChatFlowConfig from '../models/chatFlowConfig.model';
import { getDemandNoticeSeedConfig } from './demandNotice.seed';
import { getPossessionNoticeSeedConfig } from './possessionNotice.seed';
import { getSaleAuctionNoticeSeedConfig } from './saleAuctionNotice.seed';

/**
 * Seeds default (global) chat flow configs if they don't already exist.
 * Called once during server bootstrap — idempotent.
 */
export async function seedChatFlows(): Promise<void> {
  const seeds = [
    getDemandNoticeSeedConfig(),
    getPossessionNoticeSeedConfig(),
    getSaleAuctionNoticeSeedConfig(),
  ];

  for (const seed of seeds) {
    const exists = await ChatFlowConfig.findOne({
      branchId: null,
      noticeType: seed.noticeType,
      isActive: true,
    });

    if (!exists) {
      await ChatFlowConfig.create({
        branchId: null,
        noticeType: seed.noticeType,
        version: 1,
        questionFlow: seed.questionFlow,
        keywordAnswerMap: seed.keywordAnswerMap,
        isActive: true,
        effectiveFrom: new Date(),
      });
      console.log(`✅ Seeded chat flow config: ${seed.noticeType}`);
    }
  }
}
