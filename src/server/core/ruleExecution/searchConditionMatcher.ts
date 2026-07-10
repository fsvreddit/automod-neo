import escapeStringRegexp from "escape-string-regexp";
import { Matches, SearchableText, SearchOption } from "../types";

export function searchTextMatches (input: string, textToMatch: string, options: SearchOption): string[] | undefined {
    if (options.negate) {
        const negatedOptions = { ...options, negate: false };
        const result = searchTextMatches(input, textToMatch, negatedOptions);
        if (result) {
            return;
        } else {
            return [];
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

    if (options.search_method === "full-text") {
        // This matches text with leading or trailing punctuation and whitespace disregarded.
        const inputToCheck = textToMatch.trim().replace(/^[\p{P}\p{Z}]+|[\p{P}\p{Z}]+$/gu, "");
        if (options.case_sensitive) {
            if (input === inputToCheck) {
                return [textToMatch];
            } else {
                return;
            }
        } else {
            if (input.toLowerCase() === inputToCheck.toLowerCase()) {
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
        const regex = new RegExp("\\b" + escapeStringRegexp(textToMatch) + "\\b", options.case_sensitive ? "" : "i");
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

    if (options.search_method === "domain") {
        // Checks to see if the input is either the exact value, or a subdomain of the value. Ignores case-sensitive.
        const inputLower = input.toLowerCase();
        const textToMatchLower = textToMatch.toLowerCase();
        if (inputLower === textToMatchLower || inputLower.endsWith("." + textToMatchLower)) {
            return [textToMatch];
        } else {
            return;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (options.search_method === "regex") {
        const regex = new RegExp(textToMatch, options.case_sensitive ? "u" : "iu");
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
        if (!result) {
            return false;
        }
    }
    return true;
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
