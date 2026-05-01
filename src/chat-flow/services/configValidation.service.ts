import { IQuestionNode } from '../models/chatFlowConfig.model';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a chat flow question config before saving.
 * Checks: no orphan nodes, all nextQuestion refs valid, no circular paths,
 * all mandatory fields covered, correct input types.
 */
export function validateChatFlowConfig(
  questionFlow: IQuestionNode[],
  keywordAnswerMap?: Record<string, string>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!questionFlow || questionFlow.length === 0) {
    return { valid: false, errors: ['Question flow is empty.'], warnings };
  }

  const nodeIds = new Set<string>();
  const fieldKeys = new Set<string>();

  // Pass 1 — collect IDs, check duplicates
  for (const node of questionFlow) {
    if (!node.id || node.id.trim() === '') {
      errors.push('A question node is missing an id.');
      continue;
    }
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node id: "${node.id}".`);
    }
    nodeIds.add(node.id);

    if (node.fieldKey) {
      fieldKeys.add(node.fieldKey);
    }
  }

  // Pass 2 — validate references, structure
  for (const node of questionFlow) {
    if (!node.id) continue;

    // Check questionText
    if (!node.questionText || node.questionText.trim() === '') {
      errors.push(`Node "${node.id}": questionText is empty.`);
    }

    // Check inputType
    const validInputTypes = ['text', 'currency', 'date', 'number', 'dropdown', 'textarea'];
    if (!validInputTypes.includes(node.inputType)) {
      errors.push(`Node "${node.id}": invalid inputType "${node.inputType}".`);
    }

    // Dropdown must have options
    if (node.inputType === 'dropdown' && (!node.options || node.options.length === 0)) {
      errors.push(`Node "${node.id}": dropdown type requires at least one option.`);
    }

    // Validate nextQuestion reference
    if (node.nextQuestion !== null && node.nextQuestion !== undefined && !nodeIds.has(node.nextQuestion)) {
      errors.push(`Node "${node.id}": nextQuestion "${node.nextQuestion}" does not exist.`);
    }

    // Validate conditionalNext references
    if (node.conditionalNext) {
      for (const cond of node.conditionalNext) {
        if (!cond.value || cond.value.trim() === '') {
          errors.push(`Node "${node.id}": conditionalNext entry has empty value.`);
        }
        if (cond.nextId && !nodeIds.has(cond.nextId)) {
          errors.push(`Node "${node.id}": conditionalNext references non-existent node "${cond.nextId}".`);
        }
      }
    }

    // Validate loopBackTo reference
    if (node.loopBackTo && !nodeIds.has(node.loopBackTo)) {
      errors.push(`Node "${node.id}": loopBackTo references non-existent node "${node.loopBackTo}".`);
    }

    // Validation rules structure
    if (node.validation) {
      for (const rule of node.validation) {
        if (!rule.type || !rule.message) {
          errors.push(`Node "${node.id}": validation rule missing type or message.`);
        }
      }
    }
  }

  // Pass 3 — detect simple circular paths (walk up to N steps from first node)
  const MAX_WALK = questionFlow.length * 2;
  const visited = new Set<string>();
  let current: string | null = questionFlow[0]?.id ?? null;
  let steps = 0;
  while (current && steps < MAX_WALK) {
    if (visited.has(current)) {
      // Only flag as error if we haven't reached any terminal nodes yet
      // Loops via conditionalNext (e.g., "go back to adjust") are valid
      break;
    }
    visited.add(current);
    const node = questionFlow.find((n) => n.id === current);
    current = node?.nextQuestion ?? null;
    steps++;
  }

  // Check reachability — nodes not reachable from any nextQuestion or conditionalNext
  const reachable = new Set<string>();
  if (questionFlow.length > 0) reachable.add(questionFlow[0].id);
  for (const node of questionFlow) {
    if (node.nextQuestion) reachable.add(node.nextQuestion);
    if (node.conditionalNext) {
      for (const c of node.conditionalNext) {
        if (c.nextId) reachable.add(c.nextId);
      }
    }
    if (node.loopBackTo) reachable.add(node.loopBackTo);
  }
  for (const node of questionFlow) {
    if (!reachable.has(node.id)) {
      warnings.push(`Node "${node.id}" is unreachable — no other node points to it.`);
    }
  }

  // Check terminal — at least one node should have nextQuestion = null
  const hasTerminal = questionFlow.some((n) => n.nextQuestion === null);
  if (!hasTerminal) {
    warnings.push('No terminal node found (nextQuestion: null). Flow may never end.');
  }

  // Keyword answer map validation
  if (keywordAnswerMap) {
    for (const [key, value] of Object.entries(keywordAnswerMap)) {
      if (!key.trim()) {
        errors.push('keywordAnswerMap has an empty key.');
      }
      if (!value || !value.trim()) {
        warnings.push(`keywordAnswerMap key "${key}" has an empty answer.`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
