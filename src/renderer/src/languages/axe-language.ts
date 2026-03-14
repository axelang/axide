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
      { token: 'comment', foreground: '565f89', fontStyle: 'italic' },
      { token: 'comment.doc', foreground: '637095', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'bb9af7' },
      { token: 'keyword.platform', foreground: 'e0af68', fontStyle: 'bold' },
      { token: 'type', foreground: '2ac3de' },
      { token: 'string', foreground: '9ece6a' },
      { token: 'string.char', foreground: '9ece6a' },
      { token: 'number', foreground: 'ff9e64' },
      { token: 'number.hex', foreground: 'ff9e64' },
      { token: 'number.float', foreground: 'ff9e64' },
      { token: 'number.binary', foreground: 'ff9e64' },
      { token: 'constant', foreground: 'ff9e64' },
      { token: 'operator', foreground: '89ddff' },
      { token: 'delimiter', foreground: '565f89' },
      { token: 'entity.name.function', foreground: '7aa2f7' },
      { token: 'entity.name.type', foreground: '2ac3de', fontStyle: 'bold' },
      { token: 'support.function', foreground: '7dcfff', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'c0caf5' },
    ],
    colors: {
      'editor.background': '#1a1b26',
      'editor.foreground': '#c0caf5',
      'editorCursor.foreground': '#c0caf5',
      'editor.lineHighlightBackground': '#1f2035',
      'editor.selectionBackground': '#2a2c4580',
      'editor.inactiveSelectionBackground': '#2a2c4540',
      'editorLineNumber.foreground': '#3b3f5c',
      'editorLineNumber.activeForeground': '#737aa2',
      'editorIndentGuide.background': '#292e42',
      'editorIndentGuide.activeBackground': '#3b3f5c',
      'editorBracketMatch.background': '#2a2c4580',
      'editorBracketMatch.border': '#7aa2f780',
      'editor.findMatchBackground': '#e0af6840',
      'editor.findMatchHighlightBackground': '#e0af6820',
      'editorGutter.background': '#1a1b26',
      'editorWidget.background': '#16161e',
      'editorWidget.border': '#292e42',
      'editorSuggestWidget.background': '#16161e',
      'editorSuggestWidget.border': '#292e42',
      'editorSuggestWidget.selectedBackground': '#2a2c45',
      'list.hoverBackground': '#1f2035',
      'list.activeSelectionBackground': '#2a2c45',
      'input.background': '#1a1b26',
      'input.border': '#292e42',
      'input.foreground': '#c0caf5',
      'scrollbarSlider.background': '#292e4280',
      'scrollbarSlider.hoverBackground': '#565f89',
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
