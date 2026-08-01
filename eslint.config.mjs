import fsvconfig from "@fsvreddit/eslint-config";

export default [
    ...fsvconfig,
    {
        rules: {
            "@stylistic/quote-props": "off",
            "camelcase": "off",
        },
    },
];
