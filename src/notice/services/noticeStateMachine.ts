import { NoticeStatus } from '../models/notice.model';
import { ApiError } from '../../common/utils/apiError';

const validTransitions: Record<NoticeStatus, NoticeStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  rejected: ['draft'],
  approved: ['final'],
  final: ['superseded'],
  superseded: [],
};

function validateTransition(currentStatus: NoticeStatus, newStatus: NoticeStatus): boolean {
  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

function transitionStatus(currentStatus: NoticeStatus, newStatus: NoticeStatus): NoticeStatus {
  if (!validateTransition(currentStatus, newStatus)) {
    throw ApiError.badRequest(
      `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
    );
  }
  return newStatus;
}

export { validateTransition, transitionStatus };
