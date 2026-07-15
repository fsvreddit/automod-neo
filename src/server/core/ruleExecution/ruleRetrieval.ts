import { redis, settings } from "@devvit/web/server";
import { AutomodRule } from "../types";
import { AppSetting } from "../appSettings";
import { parseRules } from "../ruleParser";
import { isRemovalRule } from "../helpers";
import { addWeeks } from "date-fns";

const CACHED_UNPARSED_RULES_KEY = "cachedUnparsedRules";
const CACHED_RULES_KEY = "cachedRules";

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
    const cachedRules = await redis.get(CACHED_RULES_KEY);
    if (cachedRules) {
        return JSON.parse(cachedRules) as AutomodRule[];
    }

    const rulesYaml = await settings.get<string>(AppSetting.Rules);
    if (!rulesYaml || rulesYaml.trim() === "") {
        return [];
    }

    const rules = sortRulesForExecution(parseRules(rulesYaml));
    await redis.set(CACHED_RULES_KEY, JSON.stringify(rules), { expiration: addWeeks(new Date(), 1) });
    return rules;
}

export async function clearCachedRules () {
    await redis.del(CACHED_RULES_KEY);
}

export async function saveUnparsedRules (rawRules: string) {
    await redis.set(CACHED_UNPARSED_RULES_KEY, rawRules);
}
