import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
	{
		ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/CHANGELOG.md', '**/*.d.ts']
	},
	js.configs.recommended,
	...ts.configs.recommended,
	prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'off'
		}
	}
];
