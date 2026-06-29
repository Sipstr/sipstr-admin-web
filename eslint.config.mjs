import eslintConfig from "eslint-config-next/core-web-vitals";

const config = [
	...eslintConfig,
	{
		rules: {
			"react-hooks/set-state-in-effect": "off",
			"react-hooks/immutability": "off",
			"react-hooks/refs": "error",
			"react-hooks/rules-of-hooks": "error",
			"react/no-unescaped-entities": "error",
		},
	},
];

export default config;
