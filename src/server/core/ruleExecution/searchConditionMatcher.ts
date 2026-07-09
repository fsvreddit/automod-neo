import escapeStringRegexp from "escape-string-regexp";
import { Matches, SearchableText, SearchOption } from "../types";

export function searchTextMatches (input: string, textToMatch: string, options?: SearchOption): string[] | undefined {
    if (options?.negate) {
        const negatedOptions = { ...options, negate: false };
        const result = searchTextMatches(input, textToMatch, negatedOptions);
        if (result) {
            return;
        } else {
            return [];
        }
    }

    if (!options) {
        if (input.toLowerCase().includes(textToMatch.toLowerCase())) {
            return [textToMatch];
        } else {
            return;
        }
    }

    if (options.search_method === "full-exact") {
        if (options.case_sensitive) {
            if (input === textToMatch) {
                return [textToMatch];
            } else {
                return;
            }
        } else {
            if (input.toLowerCase() === textToMatch.toLowerCase()) {
                return [textToMatch];
            } else {
                return;
            }
        }
    }

    if (options.search_method === "starts-with") {
        if (options.case_sensitive) {
            if (input.startsWith(textToMatch)) {
                return [textToMatch];
            } else {
                return;
            }
        } else {
            if (input.toLowerCase().startsWith(textToMatch.toLowerCase())) {
                return [textToMatch];
            } else {
                return;
            }
        }
    }

    if (options.search_method === "ends-with") {
        if (options.case_sensitive) {
            if (input.endsWith(textToMatch)) {
                return [textToMatch];
            } else {
                return;
            }
        } else {
            if (input.toLowerCase().endsWith(textToMatch.toLowerCase())) {
                return [textToMatch];
            } else {
                return;
            }
        }
    }

    if (options.search_method === "includes-word") {
        const regex = new RegExp("\\b" + escapeStringRegexp(textToMatch) + "\\b", options.case_sensitive ?? false ? "" : "i");
        if (regex.test(input)) {
            return [textToMatch];
        } else {
            return;
        }
    }

    if (options.search_method === "includes") {
        if (options.case_sensitive) {
            if (input.includes(textToMatch)) {
                return [textToMatch];
            } else {
                return;
            }
        } else {
            if (input.toLowerCase().includes(textToMatch.toLowerCase())) {
                return [textToMatch];
            } else {
                return;
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (options.search_method === "regex") {
        const regex = new RegExp(textToMatch, options.case_sensitive ?? false ? "u" : "iu");
        const matches = input.match(regex);
        if (matches) {
            return matches.map(match => match.trim());
        }
        return;
    }

    throw new Error(`Unknown search method: ${options.search_method}`);
}

export function searchConditionMatchesInput (input: string, condition: SearchableText): string[] | undefined {
    for (const text of condition.text) {
        const result = searchTextMatches(input, text, condition.options);
        if (result) {
            return result;
        }
    }

    return;
}

export function anySearchConditionMatchesInput (input: string, conditions: SearchableText[]): boolean {
    for (const condition of conditions) {
        const result = searchConditionMatchesInput(input, condition);
        if (result) {
            return true;
        }
    }
    return false;
}

export function searchConditionsMatchInput (input: Record<string, string | string[]>, conditions: SearchableText[]): Matches[] | undefined {
    const matchesFound: Matches[] = [];

    for (const condition of conditions) {
        let anyMatch = false;
        for (const fieldName of condition.searchField) {
            const fieldValues = input[fieldName];
            if (Array.isArray(fieldValues)) {
                for (const fieldValue of fieldValues) {
                    const result = searchConditionMatchesInput(fieldValue, condition);
                    if (result) {
                        matchesFound.push({ category: fieldName, matches: result });
                        anyMatch = true;
                    }
                }
            } else if (typeof fieldValues === "string") {
                const result = searchConditionMatchesInput(fieldValues, condition);
                if (result) {
                    matchesFound.push({ category: fieldName, matches: result });
                    anyMatch = true;
                }
            }
        }
        if (!anyMatch) {
            return;
        }
    }

    return matchesFound;
}
