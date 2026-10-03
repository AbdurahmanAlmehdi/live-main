export * from './session.js';
export * from './llm-agent.js';
export * from './tools.js';
export * from './providers/index.js';
export * from './scripted-agent.js';
export { LiveMainStrategy } from './strategies/live-main.js';
export { PrFlowStrategy, PushToBranchStrategy, changedPaths } from './strategies/git-baselines.js';
import type { StrategyName } from '@livemain/protocol';
import type { Strategy } from './session.js';
import { LiveMainStrategy } from './strategies/live-main.js';
import { PrFlowStrategy, PushToBranchStrategy } from './strategies/git-baselines.js';

export function createStrategy(name: StrategyName): Strategy {
  switch (name) {
    case 'live-main':
      return new LiveMainStrategy();
    case 'pr-flow':
      return new PrFlowStrategy();
    case 'push-to-branch':
      return new PushToBranchStrategy();
  }
}
export * from './glob.js';
