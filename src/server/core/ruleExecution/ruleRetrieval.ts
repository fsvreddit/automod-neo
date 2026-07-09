import { AutomodRule } from "../types";
import { AppSetting } from "../appSettings";
import { parseRules } from "../ruleParser";
import { settings } from "@devvit/web/server";

function isRemovalRule (rule: AutomodRule): boolean {
    return rule.action === "remove" || rule.action === "spam" || rule.action === "filter";
}

export function sortRulesForExecution (rules: AutomodRule[]): AutomodRule[] {
    // First, add all the removal rules in priority order (highest priority first)
    const removalRules = rules.filter(isRemovalRule);
    removalRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const rulesToReturn = [...removalRules];

    // Then, add all the non-removal rules in priority order (highest priority first)
    const nonRemovalRules = rules.filter(rule => !isRemovalRule(rule));
    nonRemovalRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    rulesToReturn.push(...nonRemovalRules);

    return rulesToReturn;
}

export async function getRulesForSubreddit (): Promise<AutomodRule[]> {
    const rulesYaml = await settings.get<string>(AppSetting.Rules);
    if (!rulesYaml || rulesYaml.trim() === "") {
        return [];
    }

    const rules = parseRules(rulesYaml);
    return sortRulesForExecution(rules);
}
