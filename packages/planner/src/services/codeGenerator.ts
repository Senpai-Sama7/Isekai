import { Intent } from './intentAnalyzer';
import {
  CodeGenerationStrategy,
  CSVViewerGenerationStrategy,
  TodoAppGenerationStrategy,
  MarkdownEditorGenerationStrategy,
  GenericAppGenerationStrategy
} from './codeGenerationStrategy';

export class CodeGenerator {
  private strategies: CodeGenerationStrategy[];

  constructor() {
    this.strategies = [
      new CSVViewerGenerationStrategy(),
      new TodoAppGenerationStrategy(),
      new MarkdownEditorGenerationStrategy(),
      new GenericAppGenerationStrategy()
    ];
  }

  generate(intent: Intent): { files: Record<string, string> } {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(intent)) {
        return strategy.generate();
      }
    }

    // Fallback to generic app if no strategy matches
    return new GenericAppGenerationStrategy().generate();
  }
}
