import { PerceptionResult, UIComponent } from '@isekai/types';

export class PerceptionService {
  private componentPatterns = {
    table: /\b(table|grid|data|list|rows|columns)\b/i,
    form: /\b(form|input|field|submit|entry)\b/i,
    chart: /\b(chart|graph|plot|visualize|dashboard)\b/i,
    filter: /\b(filter|search|sort|query)\b/i,
    export: /\b(export|download|save|csv|json)\b/i,
    modal: /\b(modal|dialog|popup|overlay)\b/i,
    button: /\b(button|click|action)\b/i,
  };

  private layoutPatterns = {
    vertical: /\b(vertical|stack|column)\b/i,
    horizontal: /\b(horizontal|row|side-by-side)\b/i,
    grid: /\b(grid|matrix|layout)\b/i,
  };

  async analyzePrompt(prompt: string, context?: any): Promise<PerceptionResult> {
    const components = this.extractComponents(prompt);
    const layout = this.extractLayout(prompt);
    const interactions = this.extractInteractions(prompt);

    return {
      components,
      layout,
      interactions
    };
  }

  private extractComponents(prompt: string): UIComponent[] {
    const components: UIComponent[] = [];
    let componentIndex = 0;

    // Extract table component
    if (this.componentPatterns.table.test(prompt)) {
      components.push({
        id: `component-${componentIndex++}`,
        type: 'table',
        properties: {
          data: 'dynamic',
          sortable: true,
          filterable: this.componentPatterns.filter.test(prompt),
          pagination: true
        },
        layout: {
          x: 0,
          y: 0,
          width: 800,
          height: 400
        }
      });
    }

    // Extract filter component
    if (this.componentPatterns.filter.test(prompt)) {
      components.push({
        id: `component-${componentIndex++}`,
        type: 'input',
        properties: {
          placeholder: 'Search...',
          type: 'search',
          onChange: 'filterData'
        },
        layout: {
          x: 0,
          y: 50,
          width: 300,
          height: 40
        }
      });
    }

    // Extract export functionality
    if (this.componentPatterns.export.test(prompt)) {
      components.push({
        id: `component-${componentIndex++}`,
        type: 'button',
        properties: {
          label: 'Export',
          onClick: 'exportData',
          variant: 'primary'
        },
        layout: {
          x: 700,
          y: 50,
          width: 100,
          height: 40
        }
      });
    }

    return components;
  }

  private extractLayout(prompt: string): string {
    if (this.layoutPatterns.grid.test(prompt)) return 'grid';
    if (this.layoutPatterns.horizontal.test(prompt)) return 'horizontal';
    if (this.layoutPatterns.vertical.test(prompt)) return 'vertical';
    return 'flex'; // default layout
  }

  private extractInteractions(prompt: string): string[] {
    const interactions: string[] = [];

    if (this.componentPatterns.filter.test(prompt)) {
      interactions.push('filter');
    }

    if (this.componentPatterns.export.test(prompt)) {
      interactions.push('export');
    }

    if (this.componentPatterns.table.test(prompt)) {
      interactions.push('sort');
      interactions.push('paginate');
    }

    return interactions;
  }
}