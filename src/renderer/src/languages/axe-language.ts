import * as monaco from 'monaco-editor'

export function registerAxeLanguage(): void {
  monaco.languages.register({ id: 'axe', extensions: ['.axe'], aliases: ['Axe', 'axe', 'Axelang'] })

  monaco.languages.setMonarchTokensProvider('axe', {
    keywords: [
      'use', 'pub', 'def', 'model', 'mut', 'val', 'ref', 'if', 'elif', 'else',
      'for', 'loop', 'return', 'break', 'continue', 'assert', 'test', 'unsafe',
      'extern', 'opaque', 'foreign', 'platform', 'in', 'to', 'and', 'or', 'not',
      'cast', 'addr', 'sizeof', 'str', 'import', 'print', 'println'
    ],
    typeKeywords: [
      'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64',
      'usize', 'isize', 'f32', 'f64', 'bool', 'char', 'string', 'void'
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
        // doc comments
        [/\/\/\/.*$/, 'comment.doc'],
        // line comments
        [/\/\/.*$/, 'comment'],

        // platform keyword followed by platform name
        [/\b(platform)\s+(windows|posix|macos|linux)\b/, ['keyword', 'keyword.platform']],

        // C interop: C.function_name
        [/\bC\.[a-zA-Z_]\w*/, 'support.function'],

        // function definitions
        [/\b(def)\s+([a-zA-Z_]\w*)/, ['keyword', 'entity.name.function']],
        // model definitions
        [/\b(model)\s+([a-zA-Z_]\w*)/, ['keyword', 'entity.name.type']],

        // use statements
        [/\buse\b/, 'keyword'],
        [/\bexternal\b/, 'keyword'],

        // cast with type parameter: cast[Type]
        [/\b(cast)\s*\[/, ['keyword', { token: '@brackets', next: '@castType' }]],

        // identifiers and keywords
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type',
            '@constants': 'constant',
            '@platformNames': 'keyword.platform',
            '@default': 'identifier'
          }
        }],

        // strings
        [/"([^"\\]|\\.)*"/, 'string'],
        // chars
        [/'([^'\\]|\\.)'/, 'string.char'],

        // numbers
        [/0[xX][0-9a-fA-F_]+/, 'number.hex'],
        [/0[bB][01_]+/, 'number.binary'],
        [/[0-9]+\.[0-9]+([eE][\-+]?[0-9]+)?/, 'number.float'],
        [/[0-9][0-9_]*/, 'number'],

        // delimiters
        [/[{}()\[\]]/, '@brackets'],
        [/[;,.]/, 'delimiter'],

        // operators
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],

        // whitespace
        [/[ \t\r\n]+/, 'white'],
      ],

      castType: [
        [/[a-zA-Z_]\w*/, 'type'],
        [/\]/, { token: '@brackets', next: '@pop' }],
        [/\s+/, 'white'],
        [/ref/, 'keyword'],
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
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
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

  // Define Axide Dark theme
  monaco.editor.defineTheme('axide-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b3a3a', fontStyle: 'italic' },
      { token: 'comment.doc', foreground: '7a4a4a', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'e0556a' },
      { token: 'keyword.platform', foreground: 'e0af68', fontStyle: 'bold' },
      { token: 'type', foreground: '7dcfff' },
      { token: 'string', foreground: '9ece6a' },
      { token: 'string.char', foreground: '9ece6a' },
      { token: 'number', foreground: 'ff9e64' },
      { token: 'number.hex', foreground: 'ff9e64' },
      { token: 'number.float', foreground: 'ff9e64' },
      { token: 'number.binary', foreground: 'ff9e64' },
      { token: 'constant', foreground: 'ff9e64' },
      { token: 'operator', foreground: 'f7768e' },
      { token: 'delimiter', foreground: '6b3a3a' },
      { token: 'entity.name.function', foreground: 'f7768e' },
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

  // Define Axide Light theme
  monaco.editor.defineTheme('axide-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '9499b5', fontStyle: 'italic' },
      { token: 'comment.doc', foreground: '7a7f9a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7c3aed' },
      { token: 'keyword.platform', foreground: 'b45309', fontStyle: 'bold' },
      { token: 'type', foreground: '0891b2' },
      { token: 'string', foreground: '16a34a' },
      { token: 'number', foreground: 'ea580c' },
      { token: 'constant', foreground: 'ea580c' },
      { token: 'operator', foreground: '0369a1' },
      { token: 'entity.name.function', foreground: '2563eb' },
      { token: 'entity.name.type', foreground: '0891b2', fontStyle: 'bold' },
      { token: 'support.function', foreground: '0284c7', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#343b58',
    }
  })
}
