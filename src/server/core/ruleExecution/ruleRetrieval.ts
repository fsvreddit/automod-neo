import { AutomodRule } from "../types";
import { AppSetting } from "../appSettings";
import { parseRules } from "../ruleParser";
import { settings } from "@devvit/web/server";

function getActionPrecedence (rule: AutomodRule): number {
    switch (rule.action) {
        case "remove":
        case "spam":
            return 0;
        case "filter":
            return 1;
        case "report":
            return 2;
        default:
            return 3;
    }
}

export function sortRulesForExecution (rules: AutomodRule[]): AutomodRule[] {
    return rules
        .map((rule, index) => ({ rule, index }))
        .sort((a, b) => {
            const priorityA = a.rule.priority ?? 0;
            const priorityB = b.rule.priority ?? 0;
            if (priorityA !== priorityB) {
                return priorityB - priorityA;
            }

            const actionPrecedenceA = getActionPrecedence(a.rule);
            const actionPrecedenceB = getActionPrecedence(b.rule);
            if (actionPrecedenceA !== actionPrecedenceB) {
                return actionPrecedenceA - actionPrecedenceB;
            }

            return a.index - b.index;
        })
        .map(entry => entry.rule);
}

export async function getRulesForSubreddit (): Promise<AutomodRule[]> {
    const rulesYaml = await settings.get<string>(AppSetting.Rules);
    if (!rulesYaml || rulesYaml.trim() === "") {
        return [];
    }

    const rules = parseRules(rulesYaml);
    return sortRulesForExecution(rules);
}
