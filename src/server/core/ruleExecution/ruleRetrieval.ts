import { AutomodRule } from "../types";
import { AppSetting, getSettings } from "../appSettings";
import { parseRules } from "../ruleParser";

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
    const appSettings = await getSettings();
    return sortRulesForExecution(parseRules(appSettings[AppSetting.Rules]));
}
