import Handlebars from 'handlebars';
import { CodeBlock, RenderableContent, StringOrLink } from './renderables/types';
import { isCodeBlock, isEmptyLine, isInlineCode } from './markdown/adapters/type-utils';
import { typeDocPartial } from './markdown/templates/type-doc-partial';
import { documentablePartialTemplate } from './markdown/templates/documentable-partial-template';
import { methodsPartialTemplate } from './markdown/templates/methods-partial-template';
import { groupedMembersPartialTemplate } from './markdown/templates/grouped-members-partial-template';
import { constructorsPartialTemplate } from './markdown/templates/constructors-partial-template';
import { fieldsPartialTemplate } from './markdown/templates/fieldsPartialTemplate';
import { classMarkdownTemplate } from './markdown/templates/class-template';
import { enumMarkdownTemplate } from './markdown/templates/enum-template';
import { interfaceMarkdownTemplate } from './markdown/templates/interface-template';
import * as fs from 'fs';
import * as path from 'path';

export type CompilationRequest = {
  template: string;
  source: unknown;
};

export class Template {
  private static instance: Template;
  private static customTemplateDir: string | undefined;

  /**
   * Set the custom template directory to use for overrides.
   * Should be called before getInstance().
   */
  public static setCustomTemplateDir(dir: string) {
    Template.customTemplateDir = dir;
  }

  private constructor() {
    // Template name to default value mapping
    const templates: Record<string, string> = {
      typeDocumentation: typeDocPartial,
      documentablePartialTemplate: documentablePartialTemplate,
      methodsPartialTemplate: methodsPartialTemplate,
      constructorsPartialTemplate: constructorsPartialTemplate,
      groupedMembersPartialTemplate: groupedMembersPartialTemplate,
      fieldsPartialTemplate: fieldsPartialTemplate,
      classTemplate: classMarkdownTemplate,
      enumTemplate: enumMarkdownTemplate,
      interfaceTemplate: interfaceMarkdownTemplate,
    };

    // If customTemplateDir is set, try to load each template from it
    for (const [name, defaultValue] of Object.entries(templates)) {
      let value = defaultValue;
      if (Template.customTemplateDir) {
        const customPath = path.join(Template.customTemplateDir, `${name}.hbs`);

        if (fs.existsSync(customPath)) {
          value = fs.readFileSync(customPath, 'utf8');
        }
      }

      Handlebars.registerPartial(name, value);
    }

    Handlebars.registerHelper('link', link);
    Handlebars.registerHelper('code', convertCodeBlock);
    Handlebars.registerHelper('renderContent', resolveRenderableContent);
    Handlebars.registerHelper('heading', heading);
    Handlebars.registerHelper('inlineCode', inlineCode);
    Handlebars.registerHelper('splitAndCapitalize', splitAndCapitalize);
    Handlebars.registerHelper('eq', eq);
    Handlebars.registerHelper('add', add);
    Handlebars.registerHelper('lookup', lookup);
    Handlebars.registerHelper('parseJSON', parseJSON);
    Handlebars.registerHelper('startsWith', startsWith);
    Handlebars.registerHelper('substring', substring);
  }

  public static getInstance(): Template {
    if (!Template.instance) {
      Template.instance = new Template();
    }
    return Template.instance;
  }

  compile(request: CompilationRequest): string {
    const compiled = Handlebars.compile(request.template);
    return (
      compiled(request.source)
        .trim()
        // clean up extra newlines
        .replace(/\n{3,}/g, '\n\n')
    );
  }
}

const splitAndCapitalize = (text: string) => {
  const words = text.split(/[-_]+/);
  const capitalizedWords = [];
  for (const word of words) {
    capitalizedWords.push(word.charAt(0).toUpperCase() + word.slice(1));
  }
  return capitalizedWords.join(' ');
};

const heading = (level: number, text: string) => {
  return `${'#'.repeat(level)} ${text}`;
};

const inlineCode = (text: string) => {
  return new Handlebars.SafeString(`\`${text}\``);
};

const eq = (a: unknown, b: unknown) => {
  return a === b;
};

const add = (a: number, b: number) => {
  return a + b;
};

const lookup = (array: unknown[], index: number) => {
  return array[index];
};

const parseJSON = (jsonString: string) => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
};

const startsWith = (str: string, prefix: string) => {
  return str.startsWith(prefix);
};

const substring = (str: string, start: number, length?: number) => {
  if (length !== undefined) {
    return str.substring(start, start + length);
  }
  return str.substring(start);
};

const convertCodeBlock = (codeBlock: CodeBlock): Handlebars.SafeString => {
  return new Handlebars.SafeString(
    `
\`\`\`${codeBlock.language}
${codeBlock.content.join('\n')}
\`\`\`
  `.trim(),
  );
};

const resolveRenderableContent = (description?: RenderableContent[]): string => {
  if (!description) {
    return '';
  }

  function reduceDescription(acc: string, curr: RenderableContent) {
    if (isEmptyLine(curr)) {
      return acc + '\n';
    }
    if (isCodeBlock(curr)) {
      return acc + convertCodeBlock(curr) + '\n';
    }
    if (isInlineCode(curr)) {
      return acc + inlineCode(curr.content).toString() + ' ';
    } else {
      return acc + Handlebars.escapeExpression(link(curr)).trim() + ' ';
    }
  }

  return description.reduce(reduceDescription, '').trim();
};

const link = (source: StringOrLink): string => {
  if (typeof source === 'string') {
    return source;
  } else {
    return `[${source.title}](${source.url})`;
  }
};
