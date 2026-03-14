import * as monaco from 'monaco-editor'

export function registerAxeLanguage(): void {
  monaco.languages.register({ id: 'axe', extensions: ['.axe'], aliases: ['Axe', 'axe', 'Axelang'] })

  monaco.languages.setMonarchTokensProvider('axe', {
    keywords: [
      'use', 'pub', 'def', 'model', 'mut', 'val', 'if', 'elif', 'else',
      'when', 'is', 'for', 'loop', 'switch', 'case', 'default', 'return',
      'break', 'continue', 'defer', 'assert', 'test', 'unsafe', 'extern',
      'opaque', 'foreign', 'platform', 'in', 'to', 'and', 'or', 'not',
      'mod', 'enum', 'union', 'parallel', 'single',
      'macro', 'raw', 'overload', 'list', 'put',
    ],
    modifiers: [
      'ref', 'ref_of', 'addr_of', 'cast',
    ],
    typeKeywords: [
      'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64',
      'usize', 'isize', 'f32', 'f64', 'bool', 'char', 'void',
      'generic', 'untyped',
    ],
    constants: ['true', 'false', 'nil'],
    platformNames: ['windows', 'posix', 'macos', 'linux'],
    operators: [
      '=', '>', '<', '!', '==', '<=', '>=', '!=',
      '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^',
      '%', '<<', '>>', '+=', '-=', '*=', '/=', '::'
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    tokenizer: {
      root: [
        [/\s*\/\/\/.*$/, 'comment.doc'],
        [/\s*\/\/.*$/, 'comment'],
        [/\bplatform\b/, 'keyword', '@platformCheck'],
        [/\bC\.[a-zA-Z_]\w*/, 'support.function'],
        [/\b(?:def|macro)\b/, 'keyword', '@expectFunctionName'],
        [/\bmodel\b/, 'keyword', '@expectTypeName'],
        [/\b[a-z_]\w*(?=\s*\()/, 'entity.name.function.call'],
        [/\b[A-Z][a-zA-Z0-9_]*\b/, 'entity.name.type'],
        [/\b[A-Z_][A-Z0-9_]+\b/, 'constant'],
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@modifiers': 'keyword.modifier',
            '@typeKeywords': 'type',
            '@constants': 'constant',
            '@platformNames': 'keyword.platform',
            '@default': 'identifier'
          }
        }],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
        [/`([^`\\]|\\.)*`/, 'string'],
        [/0[xX][0-9a-fA-F_]+/, 'number.hex'],
        [/0[bB][01_]+/, 'number.binary'],
        [/[0-9]*\.[0-9]+([eE][+-]?[0-9]+)?/, 'number.float'],
        [/[0-9][0-9_]*\b/, 'number'],
        [/[{}()\[\]]/, '@brackets'],
        [/[,;]/, 'delimiter'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': 'delimiter'
          }
        }],
        [/[ \t\r\n]+/, 'white'],
      ],

      expectFunctionName: [
        [/\s+/, 'white'],
        [/[a-zA-Z_]\w*/, { token: 'entity.name.function', next: '@pop' }],
        [/./, { token: '', next: '@pop' }],
      ],

      expectTypeName: [
        [/\s+/, 'white'],
        [/[a-zA-Z_]\w*/, { token: 'entity.name.type', next: '@pop' }],
        [/./, { token: '', next: '@pop' }],
      ],

      platformCheck: [
        [/\s+/, 'white'],
        [/[a-zA-Z_]\w*/, 'identifier'],
        [/./, { token: '', next: '@pop' }],
      ],
    }
  } as any)
  monaco.languages.setLanguageConfiguration('axe', {
    comments: {
      lineComment: '//',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
      { open: '`', close: '`', notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
    ],
    folding: {
      markers: {
        start: /^\s*\{/,
        end: /^\s*\}/,
      }
    },
    indentationRules: {
      increaseIndentPattern: /.*\{\s*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
    onEnterRules: [
      {
        beforeText: /.*\{\s*$/,
        action: { indentAction: monaco.languages.IndentAction.Indent }
      }
    ]
  })

  monaco.editor.defineTheme('axide-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b3a3a', fontStyle: 'italic' },
      { token: 'comment.doc', foreground: '7a4a4a', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'e0556a' },
      { token: 'keyword.modifier', foreground: 'bb9af7' },
      { token: 'keyword.platform', foreground: 'e0af68', fontStyle: 'bold' },
      { token: 'type', foreground: '7dcfff' },
      { token: 'string', foreground: '9ece6a' },
      { token: 'number', foreground: 'ff9e64' },
      { token: 'number.hex', foreground: 'ff9e64' },
      { token: 'number.float', foreground: 'ff9e64' },
      { token: 'number.binary', foreground: 'ff9e64' },
      { token: 'constant', foreground: 'ff9e64' },
      { token: 'operator', foreground: 'f7768e' },
      { token: 'delimiter', foreground: '6b3a3a' },
      { token: 'entity.name.function', foreground: 'f7768e' },
      { token: 'entity.name.function.call', foreground: '7aa2f7' },
      { token: 'entity.name.type', foreground: '7dcfff', fontStyle: 'bold' },
      { token: 'support.function', foreground: '73daca', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'f5c0c0' },
    ],
    colors: {
      'editor.background': '#0d0d0d',
      'editor.foreground': '#f5c0c0',
      'editorCursor.foreground': '#f7768e',
      'editor.lineHighlightBackground': '#1a1212',
      'editor.selectionBackground': '#2a1a1a80',
      'editor.inactiveSelectionBackground': '#2a1a1a40',
      'editorLineNumber.foreground': '#4a2a2a',
      'editorLineNumber.activeForeground': '#f7768e',
      'editorIndentGuide.background': '#292020',
      'editorIndentGuide.activeBackground': '#4a2a2a',
      'editorBracketMatch.background': '#2a1a1a80',
      'editorBracketMatch.border': '#f7768e80',
      'editor.findMatchBackground': '#e0af6840',
      'editor.findMatchHighlightBackground': '#e0af6820',
      'editorGutter.background': '#0d0d0d',
      'editorWidget.background': '#161212',
      'editorWidget.border': '#292020',
      'editorSuggestWidget.background': '#161212',
      'editorSuggestWidget.border': '#292020',
      'editorSuggestWidget.selectedBackground': '#2a1c1c',
      'list.hoverBackground': '#1a1212',
      'list.activeSelectionBackground': '#2a1c1c',
      'input.background': '#0d0d0d',
      'input.border': '#292020',
      'input.foreground': '#f5c0c0',
      'scrollbarSlider.background': '#29202080',
      'scrollbarSlider.hoverBackground': '#6b3a3a',
    }
  })

  monaco.editor.defineTheme('axide-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '9499b5', fontStyle: 'italic' },
      { token: 'comment.doc', foreground: '7a7f9a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7c3aed' },
      { token: 'keyword.modifier', foreground: '7c3aed', fontStyle: 'italic' },
      { token: 'keyword.platform', foreground: 'b45309', fontStyle: 'bold' },
      { token: 'type', foreground: '0891b2' },
      { token: 'string', foreground: '16a34a' },
      { token: 'number', foreground: 'ea580c' },
      { token: 'constant', foreground: 'ea580c' },
      { token: 'operator', foreground: '0369a1' },
      { token: 'entity.name.function', foreground: '2563eb' },
      { token: 'entity.name.function.call', foreground: '2563eb' },
      { token: 'entity.name.type', foreground: '0891b2', fontStyle: 'bold' },
      { token: 'support.function', foreground: '0284c7', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#343b58',
    }
  })
}