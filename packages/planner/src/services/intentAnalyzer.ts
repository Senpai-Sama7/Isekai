import {
  Intent,
  IntentStrategy,
  CSVViewerStrategy,
  TodoAppStrategy,
  MarkdownEditorStrategy,
  GenericAppStrategy,
  ActionInference,
  TableSortingInference,
  SearchEnhancementInference
} from './strategies';

export { Intent };

export class IntentAnalyzer {
  private strategies: IntentStrategy[];
  private inferenceStrategies: ActionInference[];

  constructor() {
    this.strategies = [
      new CSVViewerStrategy(),
      new TodoAppStrategy(),
      new MarkdownEditorStrategy(),
      new GenericAppStrategy() // This should be last as it handles everything
    ];

    this.inferenceStrategies = [
      new TableSortingInference(),
      new SearchEnhancementInference()
    ];
  }

  analyze(prompt: string, context?: any): Intent {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(prompt)) {
        return strategy.analyze(prompt);
      }
    }

    // Fallback to generic app if no strategy matches
    return new GenericAppStrategy().analyze(prompt);
  }

  inferFromAction(action: any, context: any, history?: any[]): any[] {
    const suggestions: any[] = [];

    for (const inference of this.inferenceStrategies) {
      if (inference.canHandle(action, context)) {
        const suggestion = inference.infer(action, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions;
  }
}
